import { MAX_PHOTOS } from "@/constants/Capture";
import type { AssetCategory } from "@/constants/Colors";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import type { AveragedFix } from "@/helpers/accuracyGate";
import { requestSavePermission } from "@/hooks/Helpers";
import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { checkPhotoQuality } from "@/services/capture/PhotoQuality";
import { addCapture } from "@/services/storage/CaptureStore";
import type { SyncedUtilityPole } from "@/services/storage/LegendState";
import type {
  CaptureFlag,
  CapturedDetection,
  CapturedPhoto,
  GnssFix,
} from "@/types/Capture";
import { randomUUID } from "expo-crypto";
import { createAssetAsync } from "expo-media-library";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import type { CameraPhotoOutput } from "react-native-vision-camera";

/** Where and how the shots were located: the gate's averaged fix, or a draft's raw one. */
export interface CaptureLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  flags: CaptureFlag[];
}

export function locationFrom(
  averaged: AveragedFix | null,
  latest: GnssFix | null,
  draft: boolean,
): CaptureLocation | null {
  const flags: CaptureFlag[] = [];
  if (latest?.mocked) flags.push("mock_location");
  if (averaged && !draft) {
    const { latitude, longitude, accuracy } = averaged;
    return { latitude, longitude, accuracy, flags };
  }
  if (!latest) return null;
  return {
    latitude: latest.latitude,
    longitude: latest.longitude,
    accuracy: latest.accuracy,
    flags: [...flags, "gps_unverified"],
  };
}

/**
 * The same asset seen in several photos keeps one track id; keep its most
 * confident sighting so each asset becomes one record (§3 "detections are merged").
 */
export function mergeDetections(
  photos: readonly CapturedPhoto[],
): { detection: CapturedDetection; photo: CapturedPhoto }[] {
  const best = new Map<
    number,
    { detection: CapturedDetection; photo: CapturedPhoto }
  >();
  for (const photo of photos) {
    for (const detection of photo.detections) {
      const seen = best.get(detection.trackId);
      if (!seen || detection.confidence > seen.detection.confidence) {
        best.set(detection.trackId, { detection, photo });
      }
    }
  }
  return [...best.values()];
}

interface TakePhotoArgs {
  photoOutput: CameraPhotoOutput;
  flash: boolean;
  location: CaptureLocation;
  heading: number | null;
  detections: CapturedDetection[];
}

export interface SaveArgs {
  category: AssetCategory;
  tag: string;
  comment: string;
}

/**
 * Up to three shots of one asset, held in memory until the tag form is saved.
 * The first shot stamps the location, so later ones can't drift it. Saving
 * writes one pole record per merged detection to the offline op queue and a
 * summary row for Home; nothing is stored before that.
 */
export function useCaptureSession() {
  const { addPole } = useUtilityStorePoles();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [location, setLocation] = useState<CaptureLocation | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const takePhoto = useCallback(
    async ({
      photoOutput,
      flash,
      location: at,
      heading,
      detections,
    }: TakePhotoArgs) => {
      if (isCapturing || photos.length >= MAX_PHOTOS) return;
      setIsCapturing(true);
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
        setLocation((prev) => prev ?? at);
        setPhotos((prev) => [
          ...prev,
          {
            imageUri: path,
            capturedAt: Date.now(),
            heading,
            detections,
            quality,
          },
        ]);
      } catch (e) {
        console.error("Photo capture failed:", e);
        Alert.alert(
          strings.capture.errors.captureTitle,
          strings.capture.errors.captureMessage,
        );
      } finally {
        setIsCapturing(false);
      }
    },
    [isCapturing, photos.length],
  );

  const removePhoto = useCallback(
    (index: number) => {
      const next = photos.filter((_, i) => i !== index);
      setPhotos(next);
      // With every shot retaken, the next one stamps a fresh location.
      if (next.length === 0) setLocation(null);
    },
    [photos],
  );

  const save = useCallback(
    async ({ category, tag, comment }: SaveArgs): Promise<boolean> => {
      if (!location || photos.length === 0) return false;
      setIsSaving(true);
      try {
        const first = photos[0];
        const base = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy ?? undefined,
          flags: location.flags,
          timestamp: first.capturedAt,
          heading: first.heading ?? undefined,
          modelVersion: DETECTOR_MODEL_VERSION,
          category,
          tag,
          comment,
          synced: false,
        };
        const merged = mergeDetections(photos);
        // A shot with nothing detected is still a deliberate report.
        const records = (
          merged.length
            ? merged.map(({ detection, photo }) => ({
                ...base,
                ...detection,
                imageUri: photo.imageUri,
                detectionConfidence: detection.confidence,
                pid: randomUUID(),
              }))
            : [{ ...base, imageUri: first.imageUri, pid: randomUUID() }]
        ) as SyncedUtilityPole[];

        await addPole(records);
        addCapture({
          id: records[0].pid!,
          category,
          title:
            merged[0]?.detection.label ?? strings.categories[category].label,
          capturedAt: new Date(first.capturedAt).toISOString(),
          accuracyM: location.accuracy ?? 0,
          syncStatus: "pending",
          flagged: location.flags.length > 0,
        });
        setPhotos([]);
        setLocation(null);
        return true;
      } catch (e) {
        console.error("Saving capture failed:", e);
        Alert.alert(
          strings.capture.errors.saveTitle,
          strings.capture.errors.saveMessage,
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [addPole, location, photos],
  );

  return {
    photos,
    location,
    isCapturing,
    isSaving,
    isFull: photos.length >= MAX_PHOTOS,
    takePhoto,
    removePhoto,
    save,
  };
}
