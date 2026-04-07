import type { SyncedUtilityPole } from "@/services/storage/LegendState";
import {
  deletePoleVision,
  poleVisionDB$,
  setPoleVision,
} from "@/services/storage/LegendState";
import { useValue } from "@legendapp/state/react";
import createContextHook from "@nkzw/create-context-hook";
import { useMutation } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useCallback } from "react";


export const [UtilityStoreProvider, useUtilityStorePoles] = createContextHook(
  () => {
    const poles = useValue(poleVisionDB$.poles);
    const tracks = useValue(poleVisionDB$.tracks);

    const isLoading = poles === undefined || tracks === undefined;

    /**
     * Add pole
     */
    const addPoleMutation = useMutation({
      mutationFn: async (pole: SyncedUtilityPole | SyncedUtilityPole[]) => {
        if(Array.isArray(pole)){
          setPoleVision(pole)
          return pole;
        }
        else{
          const newPole:  SyncedUtilityPole = {
            ...pole,
            pid: randomUUID(),
            synced: false,
          };

          setPoleVision(newPole);
          console.log(`Added new pole: ${newPole.pid}`);
          return newPole;
        }
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
  },
);
