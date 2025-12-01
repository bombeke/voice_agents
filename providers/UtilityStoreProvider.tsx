import { getDatabase } from '@/services/storage/RxDB';
import type { UtilityPole, UtilityPoleDatabase } from '@/services/storage/Schema';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@utility_poles_last_sync';

export const [UtilityPoleProvider, useUtilityPoles] = createContextHook(() => {
  const [db, setDb] = useState<UtilityPoleDatabase | null>(null);
  const [poles, setPoles] = useState<UtilityPole[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const dbQuery = useQuery({
    queryKey: ['database-init'],
    queryFn: async () => {
      const database = await getDatabase();
      setDb(database);
      return database;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (dbQuery.data) {
      const subscription = dbQuery.data.utility_poles
        .find()
        .sort({ timestamp: 'desc' })
        .$.subscribe((poleDocuments: any) => {
          const poleData = poleDocuments?.map((doc: any) => doc.toJSON());
          setPoles(poleData);
          setIsInitializing(false);
          console.log(`[Database] Loaded ${poleData.length} poles`);
        });

      return () => subscription.unsubscribe();
    }
  }, [dbQuery.data]);

  const addPoleMutation = useMutation({
    mutationFn: async (pole: Omit<UtilityPole, 'id' | 'synced'>) => {
      if (!db) throw new Error('Database not initialized');
      
      const newPole: UtilityPole = {
        ...pole,
        id: `pole_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        synced: false,
      };

      await db.utility_poles.insert(newPole);
      console.log(`[Database] Added new pole: ${newPole.id}`);
      return newPole;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not initialized');
      
      const unsyncedPoles = await db.utility_poles
        .find({ selector: { synced: false } })
        .exec();

      console.log(`[Sync] Found ${unsyncedPoles.length} unsynced poles`);

      for (const poleDoc of unsyncedPoles) {
        const pole = poleDoc.toJSON();
        console.log(`[Sync] Syncing pole: ${pole.id} to DHIS2`);
        
        await poleDoc.patch({ synced: true, dhis2Id: `dhis2_${pole.id}` });
      }

      await AsyncStorage.setItem(STORAGE_KEY, Date.now().toString());
      console.log('[Sync] Sync completed successfully');
      
      return unsyncedPoles.length;
    },
  });

  const deletePole = useCallback(async (poleId: string) => {
    if (!db) throw new Error('Database not initialized');
    
    const poleDoc = await db.utility_poles.findOne(poleId).exec();
    if (poleDoc) {
      await poleDoc.remove();
      console.log(`[Database] Deleted pole: ${poleId}`);
    }
  }, [db]);

  return {
    poles,
    addPole: addPoleMutation.mutateAsync,
    syncPoles: syncMutation.mutateAsync,
    deletePole,
    isLoading: isInitializing || dbQuery.isLoading,
    isSyncing: syncMutation.isPending,
    isAddingPole: addPoleMutation.isPending,
  };
});