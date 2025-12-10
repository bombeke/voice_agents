import { deletePoleVision, poleVisionDB, setPoleVision } from '@/services/storage/LegendState';
import type { UtilityPole } from '@/services/storage/Schema';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@utility_poles_last_sync';

export const [UtilityStoreProvider, useUtilityStorePoles] = createContextHook(() => {
  const [poles, setPoles] = useState<UtilityPole[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

   useEffect(() => {
    if (!poleVisionDB) return;
    
    // Use Legend-State's 'onChange' to subscribe to the 'poles' array
    const unsubscribe = poleVisionDB.poles.onChange(({ value=[] }) => {
      // 'value' here is the latest array of poles from the observable
      console.log('[LegendState] Poles updated:', value.length);
      if(value){
        setPoles([...value]); // Create a new array to ensure React state update
      }
      
      // Mark as initialized once we have the first data
      if (isInitializing) {
        setIsInitializing(false);
      }
    });
    setPoles([...poleVisionDB.poles.get() as any]);
    setIsInitializing(false);
    
    return () => unsubscribe();
  }, []);

  /** -----------------------------
   * Add pole mutation
   * ------------------------------ */
  const addPoleMutation = useMutation({
    mutationFn: async (pole: Omit<UtilityPole, 'id' | 'synced'>) => {
      const newPole: UtilityPole = {
        ...pole,
        id:  randomUUID(),
        synced: false,
      };
      setPoleVision(newPole);
      console.log(`[Database] Added new pole: ${newPole.id}`);
      return newPole;
    },
  });

  /** -----------------------------
   * Delete pole
   * ------------------------------ */
  const deletePole = useCallback(async (id: string) => {
    deletePoleVision(id);
  },[]);

  /** -----------------------------
   * Provider return
   * ------------------------------ */
  return {
    poles,
    addPole: addPoleMutation.mutateAsync,
    //syncPoles: syncMutation.mutateAsync,
    deletePole,

    isLoading: isInitializing,
    //isSyncing: syncMutation.isPending,
    isAddingPole: addPoleMutation.isPending,
  };
});
