import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { SyncedUtilityPole } from "@/services/storage/LegendState";
import { randomUUID } from "expo-crypto";
import { Accuracy, getCurrentPositionAsync } from "expo-location";
import { createAssetAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { requestSavePermission } from "./Helpers";
import { ICameraOutputs, ITakePhotoProps } from "./Types";

export function useCameraController({ photoOutput }: ICameraOutputs) {
  const { addPole } = useUtilityStorePoles();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const onInitialized = useCallback(() => {
    setIsInitialized(true);
  }, []);

  const takePhoto = useCallback(
    async ({
      detections,
      flashMode = "off",
      position,
    }: ITakePhotoProps): Promise<boolean> => {
      try {
        setIsCapturing(true);

        // `position` is the latest fix from useCaptureAccuracyGate's
        // watchPositionAsync subscription — the same fix whose accuracy radius
        // unlocked the button. Only fall back to a fresh read if the watcher has
        // not produced one yet.
        const coords =
          position?.coords ??
          (
            await getCurrentPositionAsync({
              accuracy: Accuracy.Highest,
            })
          ).coords;

        const photo = await photoOutput.capturePhoto({ flashMode }, {});
        //const image = await photo.toImageAsync()
        const hasPermission = await requestSavePermission();
        if (!hasPermission) {
          Alert.alert(
            "Permission denied!",
            "Camera does not have permission to save the media.",
          );
          return false;
        }
        const path = await photo.saveToTemporaryFileAsync();
        await createAssetAsync(`file:///${path}`, "photo");

        const tags = detections.map(
          (d) =>
            ({
              ...d,
              latitude: coords.latitude,
              longitude: coords.longitude,
              timestamp: Date.now(),
              imageUri: path,
              detectionConfidence: d.score,
              pid: randomUUID(),
              synced: false,
            }) as SyncedUtilityPole,
        );

        // addPole() persists the capture locally and enqueues it on the
        // offline-safe op queue, which is replayed to OBSERVATIONS_SYNC_URL
        // ("/observations/v1/stream") by OpQueueReplayObserver/replayOpQueue
        // once connectivity is available — see services/storage/LegendState.ts.
        await addPole(tags);
        router.navigate("/poles/maps");
        return true;
      } catch (e) {
        console.error("Photo capture failed:", e);
        return false;
      } finally {
        setIsCapturing(false);
      }
    },
    [addPole, photoOutput, router],
  );

  return {
    isInitialized,
    isCapturing,
    onInitialized,
    takePhoto,
  };
}
