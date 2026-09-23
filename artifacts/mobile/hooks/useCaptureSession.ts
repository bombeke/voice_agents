import { MAX_PHOTOS } from "@/constants/Capture";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import { buildRecords, buildSummary } from "@/helpers/captureRecord";
import { assetFromPole } from "@/helpers/duplicateCheck";
import { tagFormProblem } from "@/helpers/tagForm";
import { requestSavePermission } from "@/hooks/Helpers";
import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { checkPhotoQuality } from "@/services/capture/PhotoQuality";
import { addCapture } from "@/services/storage/CaptureStore";
import {
  addPhoto,
  beginTagging,
  captureSession$,
  removePhoto,
  resetSession,
} from "@/services/storage/CaptureSessionStore";
import type {
  CaptureLocation,
  CapturedDetection,
  NearbyAsset,
} from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { randomUUID } from "expo-crypto";
import { createAssetAsync } from "expo-media-library";
import { useCallback } from "react";
import { Alert } from "react-native";
import type { CameraPhotoOutput } from "react-native-vision-camera";

interface TakePhotoArgs {
  photoOutput: CameraPhotoOutput;
  flash: boolean;
  location: CaptureLocation;
  heading: number | null;
  detections: CapturedDetection[];
}

async function takePhoto({
  photoOutput,
  flash,
  location,
  heading,
  detections,
}: TakePhotoArgs) {
  // Read the store synchronously so a double tap can't take two shots.
  const { isCapturing, photos } = captureSession$.peek();
  if (isCapturing || photos.length >= MAX_PHOTOS) return;
  captureSession$.isCapturing.set(true);
  try {
    const photo = await photoOutput.capturePhoto(
      { flashMode: flash ? "on" : "off" },
      {},
    );
    const path = await photo.saveToTemporaryFileAsync();
    // Also kept in the device gallery for reviewing boxes against the photo.
    if (await requestSavePermission()) {
      await createAssetAsync(`file://${path}`, "photo").catch(() => {});
    }
    const quality = await checkPhotoQuality(path);
    addPhoto(
      {
        imageUri: path,
        capturedAt: Date.now(),
        heading,
        detections,
        quality,
      },
      location,
    );
  } catch (e) {
    console.error("Photo capture failed:", e);
    Alert.alert(
      strings.capture.errors.captureTitle,
      strings.capture.errors.captureMessage,
    );
  } finally {
    captureSession$.isCapturing.set(false);
  }
}

/**
 * Up to three shots of one asset, reviewed and then tagged. The session lives
 * in CaptureSessionStore so the camera, review and tagging routes share it.
 * Saving writes one record per accepted detection to the offline op queue and
 * a summary row for Home; nothing is stored before that.
 */
export function useCaptureSession() {
  const { addPole, poles } = useUtilityStorePoles();
  const photos = useSelector(captureSession$.photos);
  const location = useSelector(captureSession$.location);
  const isCapturing = useSelector(captureSession$.isCapturing);
  const isSaving = useSelector(captureSession$.isSaving);

  /** Opens the tagging form, checking the stored records for duplicates. */
  const startTagging = useCallback(() => {
    beginTagging(
      (poles ?? [])
        .map(assetFromPole)
        .filter((a): a is NearbyAsset => a !== null),
    );
  }, [poles]);

  /**
   * Saves the tagging form: a finished record, or a draft that only needs a
   * category and goes to a supervisor. False when nothing was saved.
   */
  const save = useCallback(
    async ({ draft }: { draft: boolean }): Promise<boolean> => {
      const {
        photos: shots,
        location: at,
        detections,
        tagging: form,
        isSaving: busy,
      } = captureSession$.peek();
      if (busy || !at || shots.length === 0) return false;
      if (!form?.category || tagFormProblem(form, draft)) return false;
      captureSession$.isSaving.set(true);
      try {
        const input = {
          photos: shots,
          location: at,
          detections,
          form: { ...form, category: form.category },
          draft,
          modelVersion: DETECTOR_MODEL_VERSION,
          newId: randomUUID,
        };
        const records = buildRecords(input);
        await addPole(records);
        addCapture(buildSummary(records, input));
        resetSession();
        return true;
      } catch (e) {
        console.error("Saving capture failed:", e);
        Alert.alert(
          strings.capture.errors.saveTitle,
          strings.capture.errors.saveMessage,
        );
        return false;
      } finally {
        captureSession$.isSaving.set(false);
      }
    },
    [addPole],
  );

  return {
    photos,
    location,
    isCapturing,
    isSaving,
    isFull: photos.length >= MAX_PHOTOS,
    takePhoto,
    removePhoto,
    startTagging,
    save,
  };
}
