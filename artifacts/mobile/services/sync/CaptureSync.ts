import { captures$, setCaptureStatus } from "@/services/storage/CaptureStore";
import {
  failedOps$,
  opQueue$,
  replayOpQueue,
  retryFailedOps,
} from "@/services/storage/LegendState";
import type { CaptureSummary } from "@/types/Capture";
import { batch } from "@legendapp/state";

/** Ids the upload settled; anything in neither list stays pending (e.g. offline). */
export interface UploadResult {
  synced: string[];
  failed: string[];
}

export type CaptureUploader = (
  captures: readonly CaptureSummary[],
) => Promise<UploadResult>;

/**
 * Pushes the pole op queue, then reads each record's state off it: still
 * queued means pending, parked in failedOps$ means the server rejected it.
 * A capture's summary id is its first record's pid (see buildSummary).
 */
const opQueueUploader: CaptureUploader = async (captures) => {
  retryFailedOps();
  await replayOpQueue();
  const queued = new Set(opQueue$.peek().map((o) => o.recordLocalId));
  const rejected = new Set(failedOps$.peek().map((o) => o.recordLocalId));
  const result: UploadResult = { synced: [], failed: [] };
  for (const { id } of captures) {
    if (rejected.has(id)) result.failed.push(id);
    else if (!queued.has(id)) result.synced.push(id);
  }
  return result;
};

let uploader: CaptureUploader = opQueueUploader;
let inFlight: Promise<void> | null = null;

/** Pass nothing to restore the op-queue uploader. Dev mocks install a fake one. */
export function setCaptureUploader(next: CaptureUploader = opQueueUploader) {
  uploader = next;
}

async function run() {
  // Only one run at a time, so an "uploading" row here was cut off by a restart.
  const due = captures$.peek().filter((c) => c.syncStatus !== "synced");
  if (!due.length) return;
  const ids = due.map((c) => c.id);
  setCaptureStatus(ids, "uploading");
  try {
    const { synced, failed } = await uploader(due);
    const settled = new Set([...synced, ...failed]);
    batch(() => {
      setCaptureStatus(synced, "synced");
      setCaptureStatus(failed, "failed");
      setCaptureStatus(
        ids.filter((id) => !settled.has(id)),
        "pending",
      );
    });
  } catch (err) {
    console.warn("[sync] capture upload failed", err);
    setCaptureStatus(ids, "failed");
  }
}

/** "Sync now": uploads every unsynced record. Concurrent callers share one run. */
export function syncPendingCaptures(): Promise<void> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
