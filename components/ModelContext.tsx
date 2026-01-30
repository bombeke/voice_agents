import {
  getCachedModel,
  useInitCachedModel
} from "@/hooks/useCachedModel";
import { createContext, PropsWithChildren, ReactNode, useContext } from "react";

export interface ICachedModelContext {
  model: any;
  children: ReactNode;
}

export const CachedModelContext = createContext<any | null>(null);

export const CachedModelProvider = ({
  model,
  children,
}: ICachedModelContext) => {
  return (
    <CachedModelContext.Provider value={model}>
      {children}
    </CachedModelContext.Provider>
  );
};

export const useCachedTensorModel = () => {
  const ctx = useContext(CachedModelContext);
  if (!ctx) {
    return null;
  }
  return ctx;
};

export function CachedModelBootstrap1({ children }: any) {
  const cached = getCachedModel();
  return (
    <CachedModelProvider model={cached.model}>{children}</CachedModelProvider>
  );
}

export function CachedModelBootstrap({ children }: PropsWithChildren) {
  const ready = useInitCachedModel();

  if (!ready) {
    return null; // or splash / loader
  }

  return <>{children}</>;
}
