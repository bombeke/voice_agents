/* rxdb-expo-sqlite-adapter.ts
   - Expo SDK 54 compatible
   - uses SQLite.openDatabaseAsync(...)
   - RxDB v16 storage wiring (no rxdb-premium)
   - MMKV v4 optional init (graceful fallback)
*/

import * as FileSystem from 'expo-file-system';
import * as SQLiteModule from 'expo-sqlite';
import { createMMKV } from 'react-native-mmkv';
import { createRxDatabase } from 'rxdb';
import { queryClient } from '../Api';

// ---------- Helpers for async expo-sqlite open ----------
/**
 * Open an expo-sqlite database asynchronously.
 * Returns an object with async helpers execAsync/getAllAsync/runAsync.
 */
export async function openDatabaseAsync(dbName = 'app.db') {
  // expo-sqlite provides openDatabaseAsync in modern SDKs.
  // If it's not available, try openDatabaseSync as fallback.
  // Types: openDatabaseAsync returns a Promise<SQLiteDatabase>
  const sqlite: any = SQLiteModule as any;

  let db: any;
  if (typeof sqlite.openDatabaseAsync === 'function') {
    db = await sqlite.openDatabaseAsync(dbName);
  } else if (typeof sqlite.openDatabaseSync === 'function') {
    db = sqlite.openDatabaseSync(dbName);
  } else {
    throw new Error('expo-sqlite: no openDatabaseAsync/openDatabaseSync available.');
  }

  // wrap into promise APIs (expo returns similar but keep safe wrappers)
  const execAsync = (sql: string, args: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          args,
          () => resolve(),
          (_t: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });

  const getAllAsync = <T = any>(sql: string, args: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          args,
          (_t: any, rs: any) => {
            const out: T[] = [];
            for (let i = 0; i < rs.rows.length; i++) out.push(rs.rows.item(i));
            resolve(out);
          },
          (_t: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });

  const runAsync = (sql: string, args: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          args,
          () => resolve(),
          (_t: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });

  return { raw: db, execAsync, getAllAsync, runAsync };
}

// ---------- Simple AES helpers (placeholder) ----------
// For production use prefer WebCrypto / native crypto libs.
// We'll store plain JSON in this example; you can plug in AES encrypt/decrypt functions.
const maybeEncrypt = async (s: string) => s;
const maybeDecrypt = async (s: string) => s;

// ---------- File attachments ----------
export async function saveAttachment(localUri: string, collection: string, docId: string) {
  const dir = `${FileSystem.Directory}attachments/${collection}`;
  
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const fileName = `${docId}_${Date.now()}`;
  const dest = `${dir}/${fileName}`;
  await FileSystem.copyAsync({ from: localUri, to: dest });
  return dest;
}
export async function removeAttachment(path: string) {
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch (e) {
    /* ignore */
  }
}

// ---------- Custom SQLite-backed storage API (simple) ----------
export function getCustomAdvancedStorage(sqlite: ReturnType<typeof openDatabaseAsync>, encryptionKeyHex?: string) {
  // sqlite here is the object returned by openDatabaseAsync()
  async function ensureTable(name: string) {
    await (await sqlite).execAsync(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY NOT NULL, rev TEXT, doc TEXT NOT NULL);`);
  }

  return {
    async createCollection(name: string) {
      await ensureTable(name);
    },

    async bulkWrite(name: string, writes: { id: string; doc: any; rev?: string }[]) {
      const success: Record<string, any> = {};
      const error: Record<string, any> = {};
      for (const w of writes) {
        try {
          let payload = JSON.stringify(w.doc);
          if (encryptionKeyHex) payload = await maybeEncrypt(payload);
          await (await sqlite).runAsync(`INSERT OR REPLACE INTO ${name} (id, rev, doc) VALUES (?, ?, ?);`, [w.id, w.rev || '', payload]);
          success[w.id] = w.doc;
        } catch (e) {
          error[w.id] = e;
        }
      }
      return { success, error };
    },

    async findById(name: string, id: string) {
      const rows = await (await sqlite).getAllAsync(`SELECT id, rev, doc FROM ${name} WHERE id = ?;`, [id]);
      if (!rows || rows.length === 0) return null;
      let docStr = rows[0].doc;
      if (encryptionKeyHex) docStr = await maybeDecrypt(docStr);
      return JSON.parse(docStr);
    },

    async query(name: string, selector: any, limit?: number, skip?: number) {
      // Very small Mango -> SQL translator handling top-level equality only (extend as needed)
      const keys = Object.keys(selector || {});
      let where = '1=1';
      const params: any[] = [];
      if (keys.length) {
        const parts: string[] = [];
        for (const k of keys) {
          const v = selector[k];
          if (typeof v !== 'object') {
            parts.push(`json_extract(doc, '$.${k}') = ?`);
            params.push(v);
          } else {
            // basic operator support ($gt/$lt)
            if ('$gt' in v) {
              parts.push(`json_extract(doc, '$.${k}') > ?`); params.push(v.$gt);
            }
            if ('$lt' in v) {
              parts.push(`json_extract(doc, '$.${k}') < ?`); params.push(v.$lt);
            }
          }
        }
        if (parts.length) where = parts.join(' AND ');
      }
      let sql = `SELECT id, rev, doc FROM ${name} WHERE ${where}`;
      if (limit) sql += ` LIMIT ${limit}`;
      if (skip) sql += ` OFFSET ${skip}`;
      const rows = await (await sqlite).getAllAsync(sql, params);
      return rows.map(r => {
        let docStr = r.doc;
        // no decrypt here for simplicity (add if needed)
        return JSON.parse(docStr);
      });
    },

    async removeCollection(name: string) {
      await (await sqlite).execAsync(`DROP TABLE IF EXISTS ${name};`);
    }
  };
}

// ---------- MMKV init (v4+) with graceful fallback ----------
export function initMMKV(optId = 'app_cache') {
  try {
    // On Expo managed you must use a dev-client or prebuild to use native MMKV.
    const store = createMMKV({ id: optId });
    return store;
  } 
  catch (e) {
    // MMKV not available — return null so caller can fallback
    return null;
  }
}

// ---------- RxDB wiring: init function ----------
export async function initRxDbWithCustomSqlite(opts?: { dbName?: string; appName?: string; encryptionKeyHex?: string }) {
  const sqlite = await openDatabaseAsync(opts?.dbName || 'app.db');

  // create QueryClient for replication/network helpers if needed

  // Create a thin RxDB database that uses our custom storage
  // The RxDB storage contract expects createStorageInstance(...) returning object methods.
  const db = await createRxDatabase({
    name: opts?.appName || 'app',
    storage: {
      name: 'expo-sqlite-custom',
      statics: {},
      createStorageInstance(params: any) {
        // params.collectionName etc.
        // We forward to our storage but ensure table creation
        const storage = getCustomAdvancedStorage(sqlite as any, opts?.encryptionKeyHex);
        storage.createCollection(params.collectionName).catch(() => {});
        return {
          bulkWrite: (rows: any[]) => storage.bulkWrite(params.collectionName, rows.map(r => ({ id: r.document.id, doc: r.document, rev: r.document._rev || '' }))),
          findDocumentsById: async (ids: string[]) => {
            const out: Record<string, any> = {};
            for (const id of ids) {
              const d = await storage.findById(params.collectionName, id);
              if (d) out[id] = d;
            }
            return out;
          },
          query: (prepared: any) => storage.query(params.collectionName, prepared.selector || {}, prepared.limit, prepared.skip),
          remove: () => storage.removeCollection(params.collectionName),
          close: async () => { /* expo-sqlite has no close */ }
        } as any;
      }
    } as any,
    multiInstance: false,
    ignoreDuplicate: true
  } as any);

  return { db, sqlite, queryClient: queryClient, mmkv: initMMKV() };
}
