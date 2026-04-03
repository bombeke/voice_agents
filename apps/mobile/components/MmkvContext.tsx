import { createContext, ReactNode, useContext } from 'react';
import type { MMKV } from 'react-native-mmkv';

export interface IMMKVContext {
  storage: MMKV;
  children: ReactNode;
}

const MMKVContext = createContext<MMKV | null>(null);

export const MMKVProvider = ({
  storage,
  children
}: IMMKVContext ) => {
  return (
    <MMKVContext.Provider value={storage}>
      {children}
    </MMKVContext.Provider>
  );
}

export const useMMKVStorage =()=> {
  const ctx = useContext(MMKVContext);
  if (!ctx) {
    return null;
  };
  return ctx;
}
