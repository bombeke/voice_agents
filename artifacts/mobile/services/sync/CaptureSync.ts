import { peekDb } from "@/db/Current";
import { syncNow } from "./SyncRuntime";

let inFlight: Promise<void> | null = null;

/**
 * "Sync now": refused uploads get another go and the outbox and photo
 * workers run immediately. Each capture's row follows from what is left
 * queued for it. Concurrent callers share one run.
 */
export function syncPendingCaptures(): Promise<void> {
  const db = peekDb();
  if (!db) return Promise.resolve();
  inFlight ??= syncNow(db)
    .catch((err) => console.warn("[sync] sync now failed", err))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
