import type { CRDTPole, SyncedPole } from '@/services/storage/LegendState';
import { deletePoleVision, poleVisionDB$, setPoleVision } from '@/services/storage/LegendState';
import { useValue } from '@legendapp/state/react';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback } from 'react';

export const [UtilityStoreProvider, useUtilityStorePoles] = createContextHook(() => {
  const poles =  useValue(poleVisionDB$.poles);
  const tracks = useValue(poleVisionDB$.tracks);
  console.log("POLES OBSERVABLE:",poles)

  const isLoading = poles === undefined || tracks === undefined;

  /**
   * Add pole
   */
  const addPoleMutation = useMutation({
    mutationFn: async (pole: SyncedPole & CRDTPole) => {
      const newPole: SyncedPole & CRDTPole = {
        ...pole,
        id: randomUUID(),
        synced: false,
      };

      setPoleVision(newPole);
      console.log(`[LegendState] Added new pole: ${newPole.id}`);
      return newPole;
    },
  });

  /**
   * Delete pole
   */
  const deletePole = useCallback(async (id: string) => {
    deletePoleVision(id);
  }, []);

  return {
    poles,
    tracks,
    addPole: addPoleMutation.mutateAsync,
    deletePole,
    isLoading,
    isAddingPole: addPoleMutation.isPending,
  };
});
