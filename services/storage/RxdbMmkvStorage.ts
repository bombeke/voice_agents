/* rx-storage-mmkv-batched.ts
   MMKV-based RxDB storage with optional write-batching and multi-namespace sharding.
*/

import {
  BulkWriteRow,
  EventBulk,
  PreparedQuery,
  RxDocumentData,
  RxJsonSchema,
  RxStorageBulkWriteResponse,
  RxStorageChangeEvent,
  RxStorageCountResult,
  RxStorageDefaultCheckpoint,
  RxStorageInstance,
  RxStorageInstanceCreationParams,
  RxStorageQueryResult,
  StringKeys,
  addRxStorageMultiInstanceSupport,
  categorizeBulkWriteRows,
  ensureNotFalsy,
  getPrimaryFieldOfPrimaryKey,
  getQueryMatcher,
  getSortComparator
} from 'rxdb';

import { MMKV, createMMKV } from 'react-native-mmkv';
import { Observable, Subject } from 'rxjs';

/**
 * Public options for the storage instance
 */
export interface MMKVBatchedOptions {
  // write batching
  batching?: {
    enabled?: boolean;          // default true
    maxBatchSize?: number;      // default 50
    flushIntervalMs?: number;   // default 50 ms
  };
  // sharding / namespaces
  sharding?: {
    enabled?: boolean;          // default false
    shards?: number;            // default 4
    idHashSalt?: string;        // optional salt for hashing
  };
  // id for mmkv instances (helps in debugging)
  mmkvIdPrefix?: string;        // default 'rxdb'
}

let instanceId = 0;

/**
 * Internal helper: simple deterministic string -> integer hash
 */
function simpleHashToInt(s: string, salt = ''): number {
  let h = 2166136261 >>> 0;
  const str = salt + s;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

export interface MMKVBatchedInternals {
  mmkvs: MMKV[]; // one or multiple MMKV instances (shards)
  masterIndexNs: number; // index stored in which shard index (0..N-1)
}

export class RxStorageInstanceMMKVBatched<RxDocType>
  implements RxStorageInstance<
    RxDocType,
    MMKVBatchedInternals,
    MMKVBatchedOptions,
    RxStorageDefaultCheckpoint
  >
{
  public readonly primaryPath: StringKeys<RxDocType>;
  public readonly instanceId = instanceId++;

  private readonly changes$ = new Subject<
    EventBulk<RxStorageChangeEvent<RxDocumentData<RxDocType>>, RxStorageDefaultCheckpoint>
  >();

  // batching buffer
  private batchBuffer: Map<string, RxDocumentData<RxDocType>> = new Map();
  private batchTimer?: NodeJS.Timeout | number | null = null;
  private batchFirstAddedAt = 0;

  // keys index: stored as JSON array under key '_rxdb_keys' in master namespace
  private readonly KEYS_KEY = '_rxdb_keys';

  constructor(
    //public readonly storage: any,
    public readonly databaseName: string,
    public readonly collectionName: string,
    public readonly schema: RxJsonSchema<RxDocumentData<RxDocType>>,
    public readonly internals: MMKVBatchedInternals,
    public readonly options: MMKVBatchedOptions = {},
    public readonly tableName: string,
    public readonly devMode: boolean
  ) {
    this.primaryPath = getPrimaryFieldOfPrimaryKey(schema.primaryKey) as any;

    // ensure keys index exists
    if (!this._readKeysRaw()) {
      this._writeKeysRaw([]);
    }
  }

  // -------------------------
  // Configuration helpers
  // -------------------------
  private batchingEnabled(): boolean {
    return this.options.batching?.enabled ?? true;
  }
  private batchingMaxSize(): number {
    return this.options.batching?.maxBatchSize ?? 50;
  }
  private batchingFlushInterval(): number {
    return this.options.batching?.flushIntervalMs ?? 50;
  }
  private shardCount(): number {
    return (this.options.sharding?.enabled ? (this.options.sharding?.shards ?? 4) : 1);
  }
  private idHashSalt(): string {
    return this.options.sharding?.idHashSalt ?? '';
  }

  // -------------------------
  // MMKV helpers
  // -------------------------
  private _getShardIndexById(id: string): number {
    if (this.internals.mmkvs.length === 1) return 0;
    const n = simpleHashToInt(id, this.idHashSalt());
    return n % this.internals.mmkvs.length;
  }

  private _mmkvForId(id: string): MMKV {
    const idx = this._getShardIndexById(id);
    return this.internals.mmkvs[idx];
  }

  private _keysMMKV(): MMKV {
    // master index stored in configured shard index (masterIndexNs)
    return this.internals.mmkvs[this.internals.masterIndexNs];
  }

  private _readKeysRaw(): string[] | null {
    const raw = this._keysMMKV().getString(this.KEYS_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  private _writeKeysRaw(keys: string[]) {
    this._keysMMKV().set(this.KEYS_KEY, JSON.stringify(keys));
  }

  private _getDocRaw(id: string): RxDocumentData<RxDocType> | undefined {
    const mmkv = this._mmkvForId(id);
    const raw = mmkv.getString(id);
    if (!raw) return undefined;
    return JSON.parse(raw);
  }
  private _setDocRaw(doc: RxDocumentData<RxDocType>) {
    const id = (doc as any)[this.primaryPath];
    const mmkv = this._mmkvForId(id);
    mmkv.set(id, JSON.stringify(doc));
  }
  private _deleteDocRaw(id: string) {
    const mmkv = this._mmkvForId(id);
    mmkv.remove(id);
  }

  // -------------------------
  // Batching mechanics
  // -------------------------
  private _ensureBatchTimer() {
    if (this.batchTimer != null) return;
    const interval = this.batchingFlushInterval();
    this.batchFirstAddedAt = Date.now();
    this.batchTimer = setTimeout(() => {
      this._flushBatch().catch(err => {
        // log, but don't throw inside timer
        console.error('MMKV batch flush error', err);
      });
    }, interval) as unknown as number;
  }

  private async _flushBatch(): Promise<void> {
    if (this.batchTimer != null) {
      clearTimeout(this.batchTimer as any);
      this.batchTimer = null;
    }
    if (this.batchBuffer.size === 0) return;

    // group buffered docs by shard to minimize set() calls per shard
    const byShard: Map<number, Map<string, any>> = new Map();
    for (const [id, doc] of this.batchBuffer.entries()) {
      const idx = this._getShardIndexById(id);
      if (!byShard.has(idx)) byShard.set(idx, new Map());
      byShard.get(idx)!.set(id, JSON.stringify(doc));
    }

    // perform per-shard writes
    for (const [shardIdx, kvMap] of byShard) {
      const mmkv = this.internals.mmkvs[shardIdx];
      // mmkv has no 'multi-set' atomic API; we still minimize JS↔native calls by batching in loop
      // but we at least perform many sets in one synchronous block.
      kvMap.forEach((raw, id) => {
        mmkv.set(id, raw);
      });
    }

    // update master keys index (we must recompute union of existing keys and buffered keys)
    const currentKeys = new Set(this._readKeysRaw() || []);
    for (const id of this.batchBuffer.keys()) {
      currentKeys.add(id);
    }
    this._writeKeysRaw(Array.from(currentKeys));

    // clear buffer
    this.batchBuffer.clear();
  }

  // -------------------------
  // RxStorage interface impl
  // -------------------------
  async bulkWrite(
    documentWrites: BulkWriteRow<RxDocType>[],
    context: string
  ): Promise<RxStorageBulkWriteResponse<RxDocType>> {
    // 1) read existing docs for categorize (we must read all current docs listed in index)
    const keys = this._readKeysRaw() || [];
    const docsInDb = new Map<string, RxDocumentData<RxDocType>>();
    for (const id of keys) {
      const doc = this._getDocRaw(id);
      if (doc) docsInDb.set(id, doc);
    }

    const categorized = categorizeBulkWriteRows(
      this,
      this.primaryPath,
      docsInDb,
      documentWrites,
      context
    );

    const ret: RxStorageBulkWriteResponse<RxDocType> = {
      error: categorized.errors
    };

    // apply writes: insert/update/delete
    // If batching enabled, put into buffer then maybe flush
    const willBatch = this.batchingEnabled();

    // add all to buffer or write immediately
    const applyDocToBuffer = (doc: RxDocumentData<RxDocType>) => {
      const id = (doc as any)[this.primaryPath];
      if (willBatch) {
        this.batchBuffer.set(id, doc);
      } else {
        this._setDocRaw(doc);
      }
    };

    for (const row of categorized.bulkInsertDocs) {
      applyDocToBuffer(row.document);
    }
    for (const row of categorized.bulkUpdateDocs) {
      applyDocToBuffer(row.document);
    }
    /*for (const row of categorized.bulkDeleteDocs) {
      // deletions still stored as doc with _deleted: true
      applyDocToBuffer(row.document);
    }*/

    // if batching, maybe trigger flush immediately if size exceeded
    if (willBatch) {
      if (this.batchBuffer.size >= this.batchingMaxSize()) {
        await this._flushBatch();
      } else {
        this._ensureBatchTimer();
      }
    } else {
      // when not batching, we already wrote docs synchronously in _setDocRaw
      // ensure keys index updated: union of keys + new ids
      const currKeys = new Set(this._readKeysRaw() || []);
      //for (const row of [...categorized.bulkInsertDocs, ...categorized.bulkUpdateDocs, ...categorized.bulkDeleteDocs]) {
      for (const row of [...categorized.bulkInsertDocs, ...categorized.bulkUpdateDocs]) {
        const id = (row.document as any)[this.primaryPath];
        currKeys.add(id);
      }
      this._writeKeysRaw(Array.from(currKeys));
    }

    // emit change events if any
    if (categorized && categorized.eventBulk && categorized.eventBulk.events.length > 0) {
      const lastState = ensureNotFalsy(categorized.newestRow).document;
      categorized.eventBulk.checkpoint = {
        id: lastState[this.primaryPath],
        lwt: lastState._meta.lwt
      };
      this.changes$.next(categorized.eventBulk);
    }

    return ret;
  }

  async query(originalPreparedQuery: PreparedQuery<RxDocType>): Promise<RxStorageQueryResult<RxDocType>> {
    const query = originalPreparedQuery.query;
    const skip = query.skip ?? 0;
    const limit = query.limit ?? Infinity;
    const queryMatcher = getQueryMatcher(this.schema, query as any);

    // read all docs from index (keys)
    const keys = this._readKeysRaw() || [];
    let result: RxDocumentData<RxDocType>[] = [];
    for (const id of keys) {
      const doc = this._getDocRaw(id);
      if (!doc) continue;
      if (queryMatcher(doc)) result.push(doc);
    }

    const sortComparator = getSortComparator(this.schema, query as any);
    result = result.sort(sortComparator);
    const start = skip;
    const end = Math.min(result.length, skip + limit);
    return { documents: result.slice(start, end) };
  }

  async count(originalPreparedQuery: PreparedQuery<RxDocType>): Promise<RxStorageCountResult> {
    const res = await this.query(originalPreparedQuery);
    return { count: res.documents.length, mode: 'fast' };
  }

  async findDocumentsById(ids: string[], withDeleted: boolean): Promise<RxDocumentData<RxDocType>[]> {
    const ret: RxDocumentData<RxDocType>[] = [];
    for (const id of ids) {
      // check buffer first (unflushed)
      if (this.batchBuffer.has(id)) {
        const doc = this.batchBuffer.get(id)!;
        if (withDeleted || !doc._deleted) ret.push(doc);
        continue;
      }
      const doc = this._getDocRaw(id);
      if (!doc) continue;
      if (withDeleted || !doc._deleted) ret.push(doc);
    }
    return ret;
  }

  changeStream(): Observable<EventBulk<RxStorageChangeEvent<RxDocumentData<RxDocType>>, RxStorageDefaultCheckpoint>> {
    return this.changes$.asObservable();
  }

  async cleanup(minimumDeletedTime: number): Promise<boolean> {
    // Simple approach: iterate all keys and permanently remove docs that are _deleted and lastWriteTime < min
    const minTs = Date.now() - minimumDeletedTime;
    const keys = this._readKeysRaw() || [];
    const toKeep: string[] = [];
    for (const id of keys) {
      const doc = this._getDocRaw(id);
      if (!doc) continue;
      if (doc._deleted && doc._meta && doc._meta.lwt < minTs) {
        // permanently remove
        this._deleteDocRaw(id);
      } else {
        toKeep.push(id);
      }
    }
    this._writeKeysRaw(toKeep);
    return true;
  }

  async getAttachmentData(_documentId: string, _attachmentId: string): Promise<string> {
    throw new Error('MMKV storage does not support attachments');
  }

  async remove(): Promise<void> {
    // flush batch first
    if (this.batchBuffer.size > 0) {
      await this._flushBatch();
    }
    // delete keys & values from all shards
    const keys = this._readKeysRaw() || [];
    for (const id of keys) {
      const mmkv = this._mmkvForId(id);
      mmkv.remove(id);
    }
    this._keysMMKV().remove(this.KEYS_KEY);
  }

  async close(): Promise<void> {
    // flush pending
    if (this.batchBuffer.size > 0) {
      await this._flushBatch();
    }
    // nothing else to close for MMKV
    return;
  }
}

/**
 * Factory helper: create mmkv instances (shards) for the collection and return internals
 */
export async function createMMKVBatchedStorageInstance<RxDocType>(
  params: RxStorageInstanceCreationParams<RxDocType, MMKVBatchedOptions>
): Promise<RxStorageInstanceMMKVBatched<RxDocType>> {
  const opts = params.options || {};  

 // const storage = new RxStorageMMKV<RxDocType>(params);

  const shardCount = (opts.sharding?.enabled ? (opts.sharding?.shards ?? 4) : 1);
  const idPrefix = opts.mmkvIdPrefix ?? 'rxdb';

  const mmkvs: MMKV[] = [];
  for (let i = 0; i < shardCount; i++) {
    const id = `${idPrefix}-${params.databaseName}-${params.collectionName}-v${params.schema.version}-shard${i}`;
    mmkvs.push(createMMKV({ id }));
  }

  const internals: MMKVBatchedInternals = {
    mmkvs,
    masterIndexNs: 0 // master index stored in shard 0 for simplicity
  };

  const instance = new RxStorageInstanceMMKVBatched<RxDocType>(
    //storage,
    params.databaseName,
    params.collectionName,
    params.schema,
    internals,
    opts,
    `${params.collectionName}-${params.schema.version}`,
    params.devMode
  );

  await addRxStorageMultiInstanceSupport('mmkv-batched', params, instance);
  return instance;
}
