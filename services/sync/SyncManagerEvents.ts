import { randomUUID } from 'expo-crypto';
import { getEventByLocalId, upsertEvent } from '../storage/EventStore';
import { eventsStore$, opQueue$ } from '../storage/LegendState';
import { bumpAttempt, removeOps } from '../storage/OpQueue';
import { Dhis2EventsAdapter } from './Dhis2EventsAdapter';
import { mergeFieldLevel, mergeLWW, mergeServerWins } from './MergeStrategies';
import type { MergeStrategy, Operation, SyncOptions } from './Types';

export class EventSyncManager<T> {
  actorId: string;
  batchSize: number;
  intervalMs: number;
  mergeStrategy: MergeStrategy;
  remoteAdapter?: any;
  stopped = false;

  constructor(opts: SyncOptions<T>) {
    this.actorId = opts.actorId;
    this.batchSize = opts.batchSize ?? 25;
    this.intervalMs = opts.intervalMs ?? 30_000;
    this.mergeStrategy = opts.mergeStrategy ?? 'LWW';
    this.remoteAdapter = opts.remoteAdapter ?? Dhis2EventsAdapter;

  }

  private chooseMerge(local: any, remote: any) {
    if (this.mergeStrategy === 'LWW') return mergeLWW(local, remote);
    if (this.mergeStrategy === 'ServerWins') return mergeServerWins(local, remote);
    if (this.mergeStrategy === 'FieldLevel') return mergeFieldLevel(local, remote);
    if (typeof this.mergeStrategy === 'function') return this.mergeStrategy(local, remote);
    return mergeLWW(local, remote);
  }

  /** Push a batch of ops to DHIS2 */
  async pushOpsOnce() {
    const q = opQueue$.get();
    if (!q.length) return { ok: true, processed: 0 };

    const chunk = q.slice(0, this.batchSize);
    try {
      const importResult = await this.remoteAdapter.ingestEventOps(chunk);
      // If DHIS2 returns import summary with reference mapping, map server event ids back to local records.
      // importSummary structure varies: here we attempt to find created/updated events mapping
      const importSummary = importResult.importSummary ?? importResult;
      // Example: importSummary may contain referenceMapping or importSummaries array; adapt as needed.
      // For now, we will optimistically remove processed ops from queue and mark local records as SYNCED.
      const processedOpIds = chunk.map(o => o.opId);
      removeOps(processedOpIds);

      // Update local records meta.status = SYNCED; if server returned created event ids, update meta.id
      for (const op of chunk) {
        const localRec = getEventByLocalId(op.recordLocalId);
        if (!localRec) continue;
        // Attempt to discover server assigned id from importSummary by matching attribute/uid — this is domain-specific.
        // As a fallback, set status to SYNCED and set serverUpdatedAt = now.
        const updatedMeta = { 
            ...(localRec.meta ?? {}), 
            status: 'SYNCED', 
            serverUpdatedAt: new Date().toISOString() 
        };
        upsertEvent({ 
            ...localRec, 
            //@ts-ignore
            meta: updatedMeta 
        });
      }

      return { ok: true, processed: chunk.length, importSummary };
    } catch (err: any) {
      // increment attempts and leave in queue
      chunk.forEach(op => bumpAttempt(op.opId));
      console.error('pushOpsOnce failed', err?.message ?? err);
      return { ok: false, error: err };
    }
  }

  /** Pull remote events and merge them into local store */
  async pullAndMerge(params?: Record<string, any>) {
    try {
      const remoteEvents = await this.remoteAdapter.fetchRemoteEvents(params);

      // For each remote event, merge into local store
      const localList = eventsStore$.get();
      const localMap = new Map(localList.map(r => [r.localId, r]));

      for (const remote of remoteEvents) {
        // remote.event is server event id, remote.trackedEntityInstance etc; we rely on localId mapping via an identifier in attributes
        // If you store localId in an attribute (recommended), attempt to read it; else fallback to server id mapping.
        const localId = remote?.attributeValues?.find((a: any) => a.attribute === 'LOCAL_ID_ATTRIBUTE_ID')?.value ?? remote?.localId ?? null;
        // If no localId, we can try to map by stored server id on local records
        let local = localId ? localMap.get(localId) : localList.find(r => r.id === remote.event);

        const { merged, shouldPushLocal } = this.chooseMerge(local, { ...remote, meta: { ...(local?.meta ?? {}), serverUpdatedAt: remote.lastUpdated ?? remote.lastUpdated } });

        if (!merged) continue;

        // ensure merged.localId exists
        if (!merged.localId) merged.localId = local?.localId ?? remote.event ?? randomUUID();

        upsertEvent(merged);

        if (shouldPushLocal && local) {
          // queue an update op for this local record
          const op: Operation = {
            opId: randomUUID(),
            kind: 'update',
            recordLocalId: local.localId as any,
            payload: local,
            actor: this.actorId,
            timestamp: new Date().toISOString(),
            attempts: 0,
            idempotencyKey: `sync-push-${local.localId}-${Date.now()}`,
          };
          opQueue$.push(op);
        }
      }
      return { ok: true, pulled: remoteEvents.length };
    } catch (err) {
      console.error('pullAndMerge failed', err);
      return { ok: false, error: err };
    }
  }

  /** One iteration: push then pull */
  async runOnce(params?: Record<string, any>) {
    // push local ops first to avoid pull overwriting them
    await this.pushOpsOnce();
    await this.pullAndMerge(params);
  }

  /** start periodic sync; returns stop function */
  startAuto() {
    this.stopped = false;
    const id = setInterval(async () => {
      if (this.stopped) {
        clearInterval(id);
        return;
      }
      try {
        await this.runOnce();
      } catch (err) {
        console.warn('sync iteration error', err);
      }
    }, this.intervalMs);
    return () => { this.stopped = true; clearInterval(id); };
  }

  stop() { this.stopped = true; }
}
