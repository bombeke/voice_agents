import { createRxDatabase } from 'rxdb/plugins/core';
import {
  getRxStorageMemory
} from 'rxdb/plugins/storage-memory';
import { createMMKVBatchedStorageInstance } from './RxdbMmkvStorage';
import { photoSchema, UtilityPoleDatabase, utilityPoleSchema } from './Schema';

//addRxPlugin(RxDBQueryBuilderPlugin);

// RxDB expects a valid RxStorage object with required methods.
const mmkvRxStorage = {
  name: 'mmkv-batched',
  rxdbVersion: "16",      
  createStorageInstance: createMMKVBatchedStorageInstance
};

let dbPromise: Promise<UtilityPoleDatabase> | null = null;


export async function getDatabase(): Promise<UtilityPoleDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const db = await createRxDatabase<UtilityPoleDatabase>({
      name: 'polevision_db',
      //storage: mmkvRxStorage,
      storage: getRxStorageMemory(),
      multiInstance: false,
      ignoreDuplicate: true,
    });

    // Create all collections in one call
    await db.addCollections({
      utility_poles: {
        schema: utilityPoleSchema,
      },
      photos: {
        schema: photoSchema,
      }
    });

    console.log('[Database] RxDB initialized successfully');
    return db;
  })();

  return dbPromise;
}



// When creating collection, RxDB will call createStorageInstance with params/options.
// Configure options in collection/db creation if your RxDB wrapper allows passing storageOptions.

/*const photos = await db.addCollections({
  photos: { schema: photoSchema }
});


const collection = await db.addCollections({
  users: {
    schema: photoSchema,
    storageInstance: {
      options: {
        batching: { enabled: true, maxBatchSize: 100, flushIntervalMs: 20 },
        sharding: { enabled: true, shards: 6, idHashSalt: 'my-app-v1' },
        mmkvIdPrefix: 'myapp'
      }
    }
  }
});
*/