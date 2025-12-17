import { deletePoleVision, poleVisionDB, setPoleVision } from '@/services/storage/LegendState';
import type { UtilityPole } from '@/services/storage/Schema';
import { useSelector } from '@legendapp/state/react';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback } from 'react';

export const [UtilityStoreProvider, useUtilityStorePoles] = createContextHook(() => {
  const poles =  useSelector(() => poleVisionDB.poles.get());
  const tracks = useSelector(() => poleVisionDB.tracks.get());

  const isLoading = poles === undefined || tracks === undefined;

  /**
   * Add pole
   */
  const addPoleMutation = useMutation({
    mutationFn: async (pole: Omit<UtilityPole, 'id' | 'synced'>) => {
      const newPole: UtilityPole = {
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
