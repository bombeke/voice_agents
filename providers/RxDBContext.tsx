import { initDb } from "@/services/storage/RxdbMmkv";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";


const RxDBContext = createContext<any | null>(null);

export const RxDBProvider = ({ children }: { children: ReactNode }) => {
  const [db, setDb] = useState<any | null>(null);

  /** -----------------------------
   *  1. Initialize database once
   * ------------------------------*/
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const _db = await initDb();
        if (isMounted) setDb(_db as any);
      } 
      catch (e) {
        console.error("[DB] Failed to initialize:", e);
      }
    };

    init().then();
    
    return () => {
      isMounted = false;
    };
  }, []);

  if (!db) return null;

  return <RxDBContext.Provider value={db}>{children}</RxDBContext.Provider>;
};

export const useRxDB = () => {
  const ctx = useContext(RxDBContext);
  if (!ctx) throw new Error("useRxDB must be inside RxDBProvider");
  return ctx;
};
