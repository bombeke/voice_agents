import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { SyncedUtilityPole } from "@/services/storage/LegendState";
import { randomUUID } from "expo-crypto";
import { Accuracy, getCurrentPositionAsync } from "expo-location";
import { createAssetAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { requestSavePermission } from "./Helpers";
import {
  ICameraOutputs,
  ISavePoleProps,
  ITakePhotoProps,
  PendingCapture,
} from "./Types";

export function useCameraController({ photoOutput }: ICameraOutputs) {
  const { addPole } = useUtilityStorePoles();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onInitialized = useCallback(() => {
    setIsInitialized(true);
  }, []);

  /**
   * Takes the shot and geotags it, but commits nothing: the result is held as a
   * PendingCapture until the surveyor submits the tag form, so a mis-framed photo
   * can be retaken without leaving an orphan record in the sync queue.
   */
  const takePhoto = useCallback(
    async ({
      detections,
      flashMode = "off",
      position,
    }: ITakePhotoProps): Promise<PendingCapture | null> => {
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
        const hasPermission = await requestSavePermission();
        if (!hasPermission) {
          Alert.alert(
            "Permission denied!",
            "Camera does not have permission to save the media.",
          );
          return null;
        }
        const path = await photo.saveToTemporaryFileAsync();
        await createAssetAsync(`file:///${path}`, "photo");

        return {
          imageUri: path,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          timestamp: Date.now(),
          detections,
        };
      } catch (e) {
        console.error("Photo capture failed:", e);
        Alert.alert("Capture failed", "The photo could not be taken.");
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [photoOutput],
  );

  /**
   * Merges the tag form onto the pending capture and commits it.
   *
   * addPole() persists the capture locally and enqueues it on the offline-safe op
   * queue, which is replayed to OBSERVATIONS_SYNC_URL ("/observations/v1/stream")
   * by OpQueueReplayObserver/replayOpQueue once connectivity is available — see
   * services/storage/LegendState.ts. The tag and comment ride along in the
   * multipart `metadata` payload.
   */
  const savePole = useCallback(
    async ({ capture, tag, comment }: ISavePoleProps): Promise<boolean> => {
      try {
        setIsSaving(true);

        const shared = {
          latitude: capture.latitude,
          longitude: capture.longitude,
          timestamp: capture.timestamp,
          imageUri: capture.imageUri,
          tag,
          comment,
          synced: false,
        };

        // One record per detected pole. A shot with no detections is still a
        // report the surveyor deliberately tagged, so it is saved as a single
        // record carrying just the position and the form.
        const records: SyncedUtilityPole[] = capture.detections.length
          ? capture.detections.map(
              (d) =>
                ({
                  ...d,
                  ...shared,
                  detectionConfidence: d.score,
                  pid: randomUUID(),
                }) as SyncedUtilityPole,
            )
          : [{ ...shared, pid: randomUUID() } as SyncedUtilityPole];

        await addPole(records);
        router.navigate("/poles/maps");
        return true;
      } catch (e) {
        console.error("Saving pole failed:", e);
        Alert.alert(
          "Save failed",
          "The capture could not be saved. Please try again.",
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [addPole, router],
  );

  return {
    isInitialized,
    isCapturing,
    isSaving,
    onInitialized,
    takePhoto,
    savePole,
  };
}
