import { initRxDbWithCustomSqlite } from '@/services/storage/RxDBSQLite';
import type { UtilityPole } from '@/services/storage/Schema';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@utility_poles_last_sync';

export const [UtilityPoleProvider, useUtilityPoles] = createContextHook(() => {
  const [poles, setPoles] = useState<UtilityPole[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [db, setDb] = useState<any | null>(null);

  /** -----------------------------
   *  Initialize database once
   * ------------------------------*/
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { db: database } = await initRxDbWithCustomSqlite({ dbName: 'polevision.db' });
        if (isMounted) {
          setDb(database);
        }
      } catch (e) {
        console.error('[DB] Failed to initialize:', e);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  /** -----------------------------------------------------------
   * Subscribe to real-time RxDB changes once DB is available
   * ------------------------------------------------------------*/
  useEffect(() => {
    if (!db) return;

    // assuming 'utility_poles' is the collection name
    const sub = db.utility_poles
      .find()
      .sort({ timestamp: 'desc' })
      .$ // RxDB observable
      .subscribe((docs: any[]) => {
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
      if (!db) throw new Error('Database not initialized');

      const newPole: UtilityPole = {
        ...pole,
        id: randomUUID(),
        synced: false,
      };

      // Insert into RxDB
      await db.utility_poles.insert(newPole);

      console.log(`[Database] Added new pole: ${newPole.id}`);
      return newPole;
    },
  });

  /** -----------------------------
   * Sync mutation (example)
   * ------------------------------ */
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not initialized');

      const unsynced = await db.utility_poles
        .find({ selector: { synced: false } })
        .exec();

      console.log(`[Sync] Found ${unsynced.length} unsynced poles`);

      for (const doc of unsynced) {
        const p = doc.toJSON();
        console.log(`[Sync] Syncing pole ${p.id}`);

        await doc.patch({ synced: true, dhis2Id: `dhis2_${p.id}` });
      }

      // Example storage
      // await AsyncStorage.setItem(STORAGE_KEY, Date.now().toString());
      return unsynced.length;
    },
  });

  /** -----------------------------
   * Delete pole
   * ------------------------------ */
  const deletePole = async (poleId: string) => {
    if (!db) throw new Error('Database not initialized');

    const doc = await db.utility_poles.findOne(poleId).exec();
    if (doc) {
      await doc.remove();
      console.log(`[Database] Deleted pole: ${poleId}`);
    }
  };

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
