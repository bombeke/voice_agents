import { getDb } from "@/db/Current";
import type { AssetCategory } from "@/constants/Colors";
import { applyTagEdit } from "@/helpers/captureRecord";
import { signalOutbox } from "@/services/sync/Outbox";
import type {
  CaptureRecord,
  CaptureSummary,
  GnssStatus,
  TagForm,
} from "@/types/Capture";
import type { LocalPole } from "@/types/Observation";
import { observable } from "@legendapp/state";
import {
  captureRow,
  getOwnRecord,
  upsertOwnCaptures,
} from "./repos/CaptureRepo";
import {
  capturePoleIds,
  deleteObservation,
  isImageReferenced,
  saveObservations,
} from "./repos/ObservationRepo";
import { deleteCaptureImage, persistCaptureImage } from "./ImageStore";
import { getDeviceId } from "./LegendState";
import { trackPoints } from "@/db/schema";

/** Latest GNSS receiver state; `null` until the first fix. In memory only. */
export const gnssStatus$ = observable<GnssStatus | null>(null);

/**
 * Copies each pole's photo out of the camera's temp folder first (file IO
 * stays out of the transaction); several detections of one photo share a copy.
 */
export function persistPoleImages<T extends LocalPole>(
  poles: readonly T[],
): T[] {
  const cache = new Map<string, string>();
  return poles.map((p) =>
    p.imageUri ? { ...p, imageUri: persistCaptureImage(p.imageUri, cache) } : p,
  );
}

/**
 * Saves a new capture: its poles (queued for upload with their photos) and
 * its Home/Records row, all in one transaction. Nothing is stored if any
 * part fails. Returns the poles as stored.
 */
export async function saveCapture({
  summary,
  record,
  poles,
}: {
  summary: CaptureSummary;
  record: CaptureRecord;
  poles: readonly LocalPole[];
}): Promise<LocalPole[]> {
  const now = Date.now();
  const saved = await getDb().write(async (tx) => {
    const stored = await saveObservations(tx, poles, {
      deviceId: getDeviceId(),
      now,
      captureId: summary.id,
    });
    await upsertOwnCaptures(tx, [captureRow(summary, record, "mine", now)]);
    return stored;
  });
  signalOutbox();
  return saved;
}

/**
 * "Edit record": the changed form goes to the record, its row goes back to
 * pending, and the change is queued for the poles it made, in one
 * transaction. False when the record isn't on the device.
 */
export async function saveCaptureEdit(
  id: string,
  form: TagForm & { category: AssetCategory },
): Promise<boolean> {
  const now = Date.now();
  const saved = await getDb().write(async (tx) => {
    const own = await getOwnRecord(tx, id);
    if (!own) return false;
    const edit = applyTagEdit(own.record, own.summary, form);
    const known = await capturePoleIds(tx, own.record.poleIds);
    const queued = own.record.poleIds.filter((pid) => known.has(pid));
    if (queued.length) {
      await saveObservations(
        tx,
        queued.map((pid) => ({ pid, ...edit.poleFields })),
        { deviceId: getDeviceId(), now, captureId: id },
      );
    }
    await upsertOwnCaptures(tx, [
      captureRow(edit.summary, edit.record, "mine", now),
    ]);
    return true;
  });
  if (saved) signalOutbox();
  return saved;
}

/** Deletes a pole locally and queues the delete; frees its photo if unused. */
export async function deletePole(pid: string) {
  const db = getDb();
  const image = await db.write((tx) =>
    deleteObservation(tx, pid, { deviceId: getDeviceId(), now: Date.now() }),
  );
  signalOutbox();
  if (image && !(await isImageReferenced(db.orm, image)))
    deleteCaptureImage(image);
}

export async function addTrackPoint(point: {
  lat: number;
  lng: number;
  timestamp?: number;
}) {
  await getDb().write((tx) =>
    tx
      .insert(trackPoints)
      .values({ ...point, timestamp: point.timestamp ?? Date.now() }),
  );
}
