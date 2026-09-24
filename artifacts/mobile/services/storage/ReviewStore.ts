import type {
  RejectReason,
  ReviewDecision,
  ReviewItem,
  ReviewOutcome,
} from "@/types/Review";
import { batch, observable } from "@legendapp/state";
import { setCaptureFlagged } from "./CaptureStore";

export const REVIEW_QUEUE_STORAGE_KEY = "iip_review_queue_v1";
export const REVIEW_DECISIONS_STORAGE_KEY = "iip_review_decisions_v1";

/** Records waiting for a supervisor; persisted to MMKV by `initPersistence()` in LegendState.ts. */
export const reviewQueue$ = observable<ReviewItem[]>([]);

/**
 * Decisions by item id, pending until they are uploaded, so an approval made
 * offline is never lost.
 */
export const reviewDecisions$ = observable<Record<string, ReviewDecision>>({});

export function replaceReviewQueue(items: readonly ReviewItem[]) {
  reviewQueue$.set([...items]);
}

/**
 * Approves or rejects a queued record: it leaves the queue, the decision is
 * queued for upload, and its capture is no longer flagged on this device.
 * Returns false when the item isn't in the queue (already decided).
 */
export function decideReview(
  itemId: string,
  outcome: ReviewOutcome,
  rejectReason?: RejectReason,
  now: Date = new Date(),
): boolean {
  const item = reviewQueue$.peek().find((i) => i.id === itemId);
  if (!item) return false;

  const decision: ReviewDecision = {
    itemId,
    captureId: item.captureId,
    outcome,
    rejectReason: outcome === "rejected" ? rejectReason : undefined,
    decidedAt: now.toISOString(),
    syncStatus: "pending",
  };
  batch(() => {
    reviewQueue$.set((prev) => prev.filter((i) => i.id !== itemId));
    reviewDecisions$.set((prev) => ({ ...prev, [itemId]: decision }));
    if (item.captureId) setCaptureFlagged([item.captureId], false);
  });
  return true;
}

export function clearReviews() {
  batch(() => {
    reviewQueue$.set([]);
    reviewDecisions$.set({});
  });
}
