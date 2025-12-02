import { createContext, ReactNode, useContext } from 'react';

export interface ICachedModelContext {
  model: any;
  children: ReactNode;
}

export const CachedModelContext = createContext<any | null>(null);

export const CachedModelProvider = ({
  model,
  children
}: ICachedModelContext ) => {
  return (
    <CachedModelContext.Provider value={model}>
      {children}
    </CachedModelContext.Provider>
  );
}

export const useCachedTensorModel =()=> {
  const ctx = useContext(CachedModelContext);
  if (!ctx) {
    return null;
  };
  return ctx;
}
