import { createRxDatabase } from 'rxdb';
import { createMMKVBatchedStorageInstance } from './RxdbMmkvStorage';
import { photoSchema, UtilityPoleDatabase, utilityPoleSchema } from './Schema';


const mmkvRxStorage = {
  name: 'mmkv-batched',
  createStorageInstance: createMMKVBatchedStorageInstance,
  rxdbVersion: "3.0.0"
};

let dbPromise: Promise<UtilityPoleDatabase> | null = null;

export async function getDatabase(): Promise<UtilityPoleDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    const db = await createRxDatabase<UtilityPoleDatabase>({
      name: 'polevision_db',
      storage: mmkvRxStorage,
      ignoreDuplicate: true,
    });

    await db.addCollections({
      utility_poles: {
        schema: utilityPoleSchema,
      },
    });
    await db.addCollections({
        photos: { 
            schema: photoSchema 
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