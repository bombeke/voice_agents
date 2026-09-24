import { MAX_PHOTOS } from "@/constants/Capture";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import {
  applyTagEdit,
  buildRecord,
  buildRecords,
  buildSummary,
} from "@/helpers/captureRecord";
import { assetFromPole } from "@/helpers/duplicateCheck";
import { tagFormProblem } from "@/helpers/tagForm";
import { requestSavePermission } from "@/hooks/Helpers";
import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { checkPhotoQuality } from "@/services/capture/PhotoQuality";
import { addCapture, captures$ } from "@/services/storage/CaptureStore";
import {
  addPhoto,
  beginTagging,
  captureSession$,
  removePhoto,
  resetSession,
} from "@/services/storage/CaptureSessionStore";
import { persistCaptureImage, toFileUri } from "@/services/storage/ImageStore";
import type { SyncedUtilityPole } from "@/services/storage/LegendState";
import { records$, upsertRecord } from "@/services/storage/RecordStore";
import { currentUser$ } from "@/services/storage/UserData";
import type { AssetCategory } from "@/constants/Colors";
import type {
  CaptureLocation,
  CapturedDetection,
  NearbyAsset,
  TagForm,
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
 * Where the record detail screen finds the photos: the copies the op queue
 * made (see ImageStore), else a fresh durable copy of each shot.
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
 * "Edit record": writes the changed form to the saved record, sends the
 * change through the op queue for the records it made, and puts the row
 * back to pending.
 */
async function saveEdit(
  id: string,
  form: TagForm & { category: AssetCategory },
  addPole: (poles: SyncedUtilityPole[]) => Promise<unknown>,
  known: ReadonlySet<string>,
): Promise<boolean> {
  const record = records$[id].peek();
  const summary = captures$.peek().find((c) => c.id === id);
  if (!record || !summary) return false;
  const edit = applyTagEdit(record, summary, form);
  const queued = record.poleIds.filter((pid) => known.has(pid));
  if (queued.length) {
    // setPoleVision merges by pid, so only the changed fields are needed.
    await addPole(
      queued.map((pid) => ({ pid, ...edit.poleFields })) as SyncedUtilityPole[],
    );
  }
  upsertRecord(edit.record);
  addCapture(edit.summary);
  return true;
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
  const editingId = useSelector(captureSession$.editingId);

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
        editingId,
      } = captureSession$.peek();
      if (busy || !at || !form?.category) return false;
      if (tagFormProblem(form, draft)) return false;
      if (!editingId && shots.length === 0) return false;
      captureSession$.isSaving.set(true);
      try {
        if (editingId) {
          const known = new Set(
            (poles ?? []).map((p) => p.pid).filter(Boolean) as string[],
          );
          const saved = await saveEdit(
            editingId,
            { ...form, category: form.category },
            addPole,
            known,
          );
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
        const saved = (await addPole(records)) as
          { imageUri?: string }[] | undefined;
        const summary = buildSummary(records, input);
        addCapture(summary);
        upsertRecord(
          buildRecord(
            summary,
            records,
            input,
            storedPhotoUris(shots, records, saved),
          ),
        );
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
    [addPole, poles],
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
