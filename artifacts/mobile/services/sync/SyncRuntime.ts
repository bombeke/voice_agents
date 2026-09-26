import type { Database } from "@/db/Database";
import { isOnline$, isUnmetered$ } from "@/services/storage/NetworkState";
import { reconcileCaptureStatus } from "@/services/storage/repos/CaptureRepo";
import { markSynced, settings$ } from "@/services/storage/SettingsStore";
import { observable } from "@legendapp/state";
import { drainAttachments, retryFailedAttachments } from "./AttachmentWorker";
import { createDrainScheduler, type DrainScheduler } from "./DrainScheduler";
import { onOutboxSignal } from "./Outbox";
import { drainOutbox, retryFailed } from "./OutboxWorker";
import { deviceFiles, outboxHandlers, uploadTransport } from "./SyncTransport";

/** What sync is doing right now, for "Syncing…" indicators. In memory only. */
export const syncActivity$ = observable({ outbox: false, photos: false });

interface Runtime {
  outbox: DrainScheduler;
  photos: DrainScheduler;
  off: () => void;
}

let runtime: Runtime | null = null;
let afterPush: (() => void) | null = null;

/** Called after a run delivered something, e.g. to pull the server's view. */
export function onPushed(listener: (() => void) | null) {
  afterPush = listener;
}

const photosAllowed = () =>
  isOnline$.peek() && (!settings$.wifiOnlyPhotos.peek() || isUnmetered$.peek());

/**
 * Starts the outbox and photo workers for the user's database. Each is
 * single-flight and keeps its schedule in the database (`next_attempt_at`),
 * so a restart picks up exactly where the last run stopped.
 */
export function startSync(db: Database) {
  stopSync();
  const outbox = createDrainScheduler(
    async () => {
      syncActivity$.outbox.set(true);
      try {
        const result = await drainOutbox(db, outboxHandlers);
        if (result.sent > 0) {
          markSynced();
          afterPush?.();
          photos.signal(0);
        }
        return result;
      } finally {
        syncActivity$.outbox.set(false);
      }
    },
    { canRun: () => isOnline$.peek(), label: "outbox" },
  );
  const photos = createDrainScheduler(
    async () => {
      syncActivity$.photos.set(true);
      try {
        return await drainAttachments(db, deviceFiles, uploadTransport, {
          canUpload: photosAllowed,
        });
      } finally {
        syncActivity$.photos.set(false);
      }
    },
    { canRun: photosAllowed, label: "photos" },
  );
  const offSignal = onOutboxSignal(() => outbox.signal());
  // "Photos on Wi-Fi only" turned off: waiting photos may go now.
  const offSetting = settings$.wifiOnlyPhotos.onChange(() => photos.signal(0));
  const off = () => {
    offSignal();
    offSetting();
  };
  runtime = { outbox, photos, off };
  // Cold start: whatever was left queued goes out now.
  outbox.signal(0);
  photos.signal(0);
}

/** Stops the workers; resolves once a run in progress has finished. */
export async function stopSync() {
  if (!runtime) return;
  const { outbox, photos, off } = runtime;
  runtime = null;
  off();
  outbox.stop();
  photos.stop();
  await Promise.all([outbox.settle(), photos.settle()]);
}

/** Reconnect, foreground, a setting change: try again now. */
export function wakeSync() {
  runtime?.outbox.signal(0);
  runtime?.photos.signal(0);
}

/** "Sync now": refused items get another go, and both workers run now. */
export async function syncNow(db: Database) {
  await retryFailed(db);
  await retryFailedAttachments(db);
  await runtime?.outbox.runNow();
  await runtime?.photos.runNow();
  if (isOnline$.peek()) await db.write(reconcileCaptureStatus);
}
