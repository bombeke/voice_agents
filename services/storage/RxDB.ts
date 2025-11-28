import { addRxPlugin, createRxDatabase } from "rxdb";
//import { getRxStorageMMKV } from "rxdb/plugins/mmkv";
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import type { UtilityPoleDatabase } from './Schema';
import { utilityPoleSchema } from './Schema';

addRxPlugin(require("rxdb/plugins/replication"));
/*
export async function initDB() {
  const db = await createRxDatabase({
    name: "photos",
    storage: getRxStorageMMKV(),   // mobile optimized storage
    multiInstance: true
  });

  await db.addCollections({
    photos: { schema: photoSchema }
  });

  return db;
}
*/


let dbPromise: Promise<UtilityPoleDatabase> | null = null;

export async function getDatabase(): Promise<UtilityPoleDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    const db = await createRxDatabase<UtilityPoleDatabase>({
      name: 'utility_poles_db',
      storage: getRxStorageDexie(),
      ignoreDuplicate: true,
    });

    await db.addCollections({
      utility_poles: {
        schema: utilityPoleSchema,
      },
    });

    console.log('[Database] RxDB initialized successfully');
    return db;
  })();

  return dbPromise;
}

export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.remove();
    dbPromise = null;
    console.log('[Database] Database reset successfully');
  }
}
