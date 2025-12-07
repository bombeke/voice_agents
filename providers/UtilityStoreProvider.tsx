
import { getDatabase } from '@/services/storage/RxdbMmkv';
import type { UtilityPole, UtilityPoleDatabase } from '@/services/storage/Schema';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { isRxDatabase } from 'rxdb/plugins/core';

const STORAGE_KEY = '@utility_poles_last_sync';

export const [UtilityPoleProvider, useUtilityPoles] = createContextHook(() => {
  const [db, setDb] = useState<UtilityPoleDatabase | null>(null);
  const [dbValid, setDbValid] = useState<boolean>(false);
  const [poles, setPoles] = useState<UtilityPole[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const dbQuery = useQuery({
    queryKey: ['database-init'],
    queryFn: async () => {
      const database = await getDatabase();
      if(isRxDatabase(database)){
        setDb(database);
        setDbValid(true);
      }      
      return database;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (dbQuery.data && dbValid) {
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
  }, [dbQuery.data, dbValid]);
console.log("Query Data:",dbQuery.data)
  const addPoleMutation = useMutation({
    mutationFn: async (pole: Omit<UtilityPole, 'id' | 'synced'>) => {
      console.log("DB:",db)
      if (!db) throw new Error('Database not initialized');
      
      const newPole: UtilityPole = {
        ...pole,
        id: `pole_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        synced: false,
      };
      console.log("DB Pole:", newPole);
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