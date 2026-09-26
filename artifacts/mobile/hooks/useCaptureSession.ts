import { MAX_PHOTOS } from "@/constants/Capture";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import {
  buildRecord,
  buildRecords,
  buildSummary,
} from "@/helpers/captureRecord";
import { assetFromPole } from "@/helpers/duplicateCheck";
import { tagFormProblem } from "@/helpers/tagForm";
import { requestSavePermission } from "@/hooks/Helpers";
import { checkPhotoQuality } from "@/services/capture/PhotoQuality";
import { peekDb } from "@/db/Current";
import {
  persistPoleImages,
  saveCapture,
  saveCaptureEdit,
} from "@/services/storage/CaptureStore";
import {
  addPhoto,
  beginTagging,
  captureSession$,
  removePhoto,
  resetSession,
} from "@/services/storage/CaptureSessionStore";
import { persistCaptureImage, toFileUri } from "@/services/storage/ImageStore";
import { nearbyObservations } from "@/services/storage/repos/ObservationRepo";
import type { SyncedUtilityPole } from "@/types/Observation";
import { currentUser$ } from "@/services/storage/UserData";
import type {
  CaptureLocation,
  CaptureMetadata,
  CapturedDetection,
  NearbyAsset,
} from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { randomUUID } from "expo-crypto";
import { createAssetAsync } from "expo-media-library";
import { useCallback } from "react";
import { Alert } from "react-native";

/** A shot from either camera engine, before it joins the session. */
export interface Shot {
  path: string;
  detections: CapturedDetection[];
  metadata?: CaptureMetadata;
}

interface TakePhotoArgs {
  /** Takes the picture: VisionCamera (CameraShot.ts) or the AR view (useArCapture). */
  shoot: () => Promise<Shot>;
  location: CaptureLocation;
  heading: number | null;
}

async function takePhoto({ shoot, location, heading }: TakePhotoArgs) {
  // Read the store synchronously so a double tap can't take two shots.
  const { isCapturing, photos } = captureSession$.peek();
  if (isCapturing || photos.length >= MAX_PHOTOS) return;
  captureSession$.isCapturing.set(true);
  try {
    const { path, detections, metadata } = await shoot();
    // Also kept in the device gallery for reviewing boxes against the photo.
    if (await requestSavePermission()) {
      await createAssetAsync(toFileUri(path)!, "photo").catch(() => {});
    }
    const quality = await checkPhotoQuality(path);
    const id = randomUUID();
    addPhoto(
      {
        id,
        imageUri: path,
        capturedAt: Date.now(),
        heading,
        // Each detection points back at the photo it was found in.
        detections: detections.map((d) => ({ ...d, photoId: id })),
        quality,
        ...(metadata ? { metadata } : {}),
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
 * Where the record detail screen finds the photos: the copies
 * persistPoleImages made (see ImageStore), else a fresh durable copy of each shot.
 */
function storedPhotoUris(
  shots: readonly { imageUri: string }[],
  records: readonly SyncedUtilityPole[],
  saved: readonly { imageUri?: string }[] | undefined,
): string[] {
  const cache = new Map<string, string>();
  records.forEach((r, i) => {
    const from = toFileUri(r.imageUri);
    const to = saved?.[i]?.imageUri;
    if (from && to) cache.set(from, to);
  });
  return shots.map((s) => persistCaptureImage(s.imageUri, cache) ?? s.imageUri);
}

/**
 * Stored records within this distance of the fix are duplicate candidates;
 * wide enough for assets ranged well away from the phone.
 */
const NEARBY_QUERY_RADIUS_M = 250;

/**
 * Up to three shots of one asset, reviewed and then tagged. The session lives
 * in CaptureSessionStore so the camera, review and tagging routes share it.
 * Saving writes one record per accepted detection, its outbox rows and a
 * summary row for Home in one SQLite transaction; nothing is stored before.
 */
export function useCaptureSession() {
  const photos = useSelector(captureSession$.photos);
  const location = useSelector(captureSession$.location);
  const isCapturing = useSelector(captureSession$.isCapturing);
  const isSaving = useSelector(captureSession$.isSaving);
  const editingId = useSelector(captureSession$.editingId);

  /**
   * Opens the tagging form, checking stored records near the fix for
   * duplicates (an indexed box query, not every record).
   */
  const startTagging = useCallback(async () => {
    const at = captureSession$.location.peek();
    const db = peekDb();
    const poles =
      at && db
        ? await nearbyObservations(db.orm, at, NEARBY_QUERY_RADIUS_M).catch(
            () => [],
          )
        : [];
    beginTagging(
      poles.map(assetFromPole).filter((a): a is NearbyAsset => a !== null),
    );
  }, []);

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
        editingId,
      } = captureSession$.peek();
      if (busy || !at || !form?.category) return false;
      if (tagFormProblem(form, draft)) return false;
      if (!editingId && shots.length === 0) return false;
      captureSession$.isSaving.set(true);
      try {
        if (editingId) {
          const saved = await saveCaptureEdit(editingId, {
            ...form,
            category: form.category,
          });
          if (saved) resetSession();
          return saved;
        }
        const input = {
          photos: shots,
          location: at,
          detections,
          form: { ...form, category: form.category },
          draft,
          modelVersion: DETECTOR_MODEL_VERSION,
          newId: randomUUID,
          capturedBy: currentUser$.peek() ?? undefined,
        };
        const records = buildRecords(input);
        // File copies first: IO stays out of the transaction.
        const persisted = persistPoleImages(records);
        const summary = buildSummary(persisted, input);
        await saveCapture({
          summary,
          record: buildRecord(
            summary,
            persisted,
            input,
            storedPhotoUris(shots, records, persisted),
          ),
          poles: persisted,
        });
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
    [],
  );

  return {
    photos,
    location,
    isCapturing,
    isSaving,
    /** The saved record being edited; null for a new capture. */
    editingId,
    isFull: photos.length >= MAX_PHOTOS,
    takePhoto,
    removePhoto,
    startTagging,
    save,
  };
}
