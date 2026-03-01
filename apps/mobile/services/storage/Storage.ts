import { createMMKV, MMKV } from 'react-native-mmkv';

let storage: MMKV | null = null;

export const createUserStorage =(userId?: string) => {
  if (storage) return storage;

  storage = createMMKV({
    id: `user-${userId || 'mmkv'}-storage`,
    //path: `${USER_DIRECTORY}/storage`,
    encryptionKey: 'hunter2',
    mode: 'multi-process',
    readOnly: false
  });

  return storage;
}

export const getStorage =() =>{
  if (!storage) {
    throw new Error("Storage not initialized.");
  }
  return storage;
}

export const saveToCache =(key: string, value: any) =>{
  const storage = createUserStorage();
  storage.set(key, JSON.stringify(value));
}


export function readFromCache<T = any>(key: string): T | null {
  const storage = createUserStorage();
  const s = storage.getString(key);
  if (!s) return null;
  return JSON.parse(s) as T;
}

export function saveGeoTag(tag: any[]) {
  const storage = createUserStorage();
  const raw = storage.getString("geotags") || "[]";
  const arr = JSON.parse(raw);
  arr.push(tag);
  storage.set("geotags", JSON.stringify(arr));
}

export function getGeoTags() {
  const storage = createUserStorage();
  const raw = storage.getString("geotags") || "[]";
  return JSON.parse(raw);
}
