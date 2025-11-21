import { addRxPlugin } from "rxdb";
//import { getRxStorageMMKV } from "rxdb/plugins/mmkv";

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