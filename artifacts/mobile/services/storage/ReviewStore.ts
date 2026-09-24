import type { CaptureSyncStatus } from "@/types/Capture";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewBatch,
  ReviewBatchResponse,
  ReviewDecision,
  ReviewItem,
  ReviewOutcome,
  TeamRecord,
} from "@/types/Review";
import { batch, observable } from "@legendapp/state";
import { setCaptureFlagged } from "./CaptureStore";

export const REVIEW_QUEUE_STORAGE_KEY = "iip_review_queue_v1";
export const REVIEW_DECISIONS_STORAGE_KEY = "iip_review_decisions_v1";
export const REVIEW_BATCH_STORAGE_KEY = "iip_review_batch_v1";
export const TEAM_RECORDS_STORAGE_KEY = "iip_team_records_v1";
export const MY_REVIEWS_STORAGE_KEY = "iip_my_reviews_v1";

/*
 * Every store here belongs to the signed-in user and is saved to their own
 * database by `openUserData()` (UserData.ts).
 */

/** Records waiting for this supervisor, from downloaded batches. */
export const reviewQueue$ = observable<ReviewItem[]>([]);

/**
 * Decisions by item id, pending until they are uploaded, so an approval made
 * offline is never lost.
 */
export const reviewDecisions$ = observable<Record<string, ReviewDecision>>({});

/** The last batch downloaded; null before the first. */
export const reviewBatch$ = observable<ReviewBatch | null>(null);

/** Other enumerators' records this supervisor downloaded, by record id. */
export const teamRecords$ = observable<Record<string, TeamRecord>>({});

/** The server's verdict on the user's own routed records, by capture id. */
export const myReviewStatus$ = observable<Record<string, MyReviewStatus>>({});

/**
 * Adds a downloaded batch: its items join the queue (one per id, never one
 * already decided here) and its records become readable offline.
 */
export function applyReviewBatch(
  { batchId, items, records }: ReviewBatchResponse,
  now: Date = new Date(),
) {
  const decided = reviewDecisions$.peek();
  batch(() => {
    reviewQueue$.set((prev) => {
      const have = new Set(prev.map((i) => i.id));
      const added = items.filter((i) => !have.has(i.id) && !decided[i.id]);
      return [...prev, ...added];
    });
    addTeamRecords(records);
    reviewBatch$.set({
      id: batchId,
      downloadedAt: now.toISOString(),
      size: items.length,
    });
  });
}

/** Adds or refreshes team records by id. */
export function addTeamRecords(records: readonly TeamRecord[]) {
  if (!records.length) return;
  teamRecords$.set((prev) => ({
    ...prev,
    ...Object.fromEntries(records.map((r) => [r.summary.id, r])),
  }));
}

/** Decisions the server hasn't confirmed yet, oldest first. */
export function unsentDecisions(): ReviewDecision[] {
  return Object.values(reviewDecisions$.peek())
    .filter((d) => d.syncStatus !== "synced")
    .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
}

export function setDecisionStatus(itemId: string, status: CaptureSyncStatus) {
  const decision = reviewDecisions$.peek()[itemId];
  if (!decision || decision.syncStatus === status) return;
  reviewDecisions$.set((prev) => ({
    ...prev,
    [itemId]: { ...decision, syncStatus: status },
  }));
}

/** Replaces the known verdicts with the server's list. */
export function replaceMyReviews(statuses: readonly MyReviewStatus[]) {
  myReviewStatus$.set(
    Object.fromEntries(statuses.map((s) => [s.captureId, s])),
  );
}

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
    reviewBatch$.set(null);
    teamRecords$.set({});
    myReviewStatus$.set({});
  });
}
