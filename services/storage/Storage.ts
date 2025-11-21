import { createMMKV, MMKV } from 'react-native-mmkv';

let storage: MMKV | null = null;

export const createUserStorage =(userId: string) => {
  if (storage) return storage;

  storage = createMMKV({
    id: `user-${userId}-storage`,
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
