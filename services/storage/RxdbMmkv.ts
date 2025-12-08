import { addRxPlugin, createRxDatabase } from 'rxdb/plugins/core';
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { createMMKVBatchedStorageInstance } from './RxdbMmkvStorage';
import { utilityPoleSchema } from './Schema';
//import { RxDBReplicationPlugin } from "rxdb/plugins/replication";
import { RxDBJsonDumpPlugin } from "rxdb/plugins/json-dump";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
//addRxPlugin(RxDBReplicationPlugin);
addRxPlugin(RxDBUpdatePlugin);
// RxDB expects a valid RxStorage object with required methods.

export const mmkvRxStorage = {
  name: 'mmkv-batched',
  rxdbVersion: "16",   
  statics: {},   
  createStorageInstance: createMMKVBatchedStorageInstance
};


export const initDb = async () => {
  let db;
  try {
    db = await createRxDatabase({
      name: 'polevision_db',
      storage: mmkvRxStorage
    });
    console.log('Database initialized in memory');
    // You can now add collections and use the database
  //return db;
  }
  catch(err){
    console.log("DB failed:",err)
  }
  try {
    if(!db) return;

    await db.addCollections({
      utility_poles: {
        schema: utilityPoleSchema,
      },
      /*photos: {
        schema: photoSchema,
     }*/
    });
  }
  catch(colErr){
    console.log("Col error:",colErr)
  }
  return db;
};

export type PoleVisionDatabaseType = Awaited<ReturnType<typeof initDb>>;


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