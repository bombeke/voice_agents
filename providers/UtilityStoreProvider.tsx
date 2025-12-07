import { initDb } from '@/services/storage/RxdbMmkv';
import type { UtilityPole, UtilityPoleDatabase } from '@/services/storage/Schema';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@utility_poles_last_sync';

export const [UtilityPoleProvider, useUtilityPoles] = createContextHook(() => {
  const [db, setDb] = useState<UtilityPoleDatabase | null>(null);
  const [poles, setPoles] = useState<UtilityPole[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  /** -----------------------------
   *  1. Initialize database once
   * ------------------------------*/
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const _db = await initDb();
        if (isMounted) setDb(_db as any);
      } catch (e) {
        console.error("[DB] Failed to initialize:", e);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  /** -----------------------------------------------------------
   * 2. Subscribe to real-time RxDB changes once DB is available
   * ------------------------------------------------------------*/
  useEffect(() => {
    if (!db) return;

    const sub = db.utility_poles
      .find()
      .sort({ timestamp: 'desc' })
      .$.subscribe((docs: any[]) => {
        console.log('Docs:',docs)
        const mapped = docs?.map(d => d.toJSON()) ?? [];
        setPoles(mapped);
        setIsInitializing(false);
        console.log(`[Database] Loaded ${mapped.length} poles`);
      });

    return () => sub.unsubscribe();
  }, [db]);

  /** -----------------------------
   * Add pole mutation
   * ------------------------------ */
  const addPoleMutation = useMutation({
    mutationFn: async (pole: Omit<UtilityPole, 'id' | 'synced'>) => {
      console.log("db",db)
      if (!db) throw new Error("Database not initialized");

      const newPole: UtilityPole = {
        ...pole,
        id:  randomUUID(),
        synced: false,
      };
      console.log("XXX")
      await db.utility_poles.insert(newPole);
      console.log(`[Database] Added new pole: ${newPole.id}`);
      return newPole;
    },
  });

  /** -----------------------------
   * Sync mutation
   * ------------------------------ */
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!db) throw new Error("Database not initialized");

      const unsynced = await db.utility_poles
        .find({ selector: { synced: false } })
        .exec();

      console.log(`[Sync] Found ${unsynced.length} unsynced poles`);

      for (const doc of unsynced) {
        const p = doc.toJSON();
        console.log(`[Sync] Syncing pole ${p.id}`);

        await doc.patch({ synced: true, dhis2Id: `dhis2_${p.id}` });
      }

      await AsyncStorage.setItem(STORAGE_KEY, Date.now().toString());
      return unsynced.length;
    },
  });

  /** -----------------------------
   * Delete pole
   * ------------------------------ */
  const deletePole = useCallback(
    async (poleId: string) => {
      if (!db) throw new Error("Database not initialized");

      const doc = await db.utility_poles.findOne(poleId).exec();
      if (doc) {
        await doc.remove();
        console.log(`[Database] Deleted pole: ${poleId}`);
      }
    },
    [db]
  );

  /** -----------------------------
   * Provider return
   * ------------------------------ */
  return {
    poles,
    addPole: addPoleMutation.mutateAsync,
    syncPoles: syncMutation.mutateAsync,
    deletePole,

    isLoading: isInitializing,
    isSyncing: syncMutation.isPending,
    isAddingPole: addPoleMutation.isPending,
  };
});
