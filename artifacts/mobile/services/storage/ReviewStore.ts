import { getDb } from "@/db/Current";
import { signalOutbox } from "@/services/sync/Outbox";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewBatchResponse,
  ReviewOutcome,
  TeamRecord,
} from "@/types/Review";
import { upsertTeamRecords } from "./repos/CaptureRepo";
import * as repo from "./repos/ReviewRepo";

/*
 * The supervisor's review data lives in the user's database (ReviewRepo);
 * these are the app's entry points for changing it.
 */

/** Adds a downloaded batch to the queue and its records to Team. */
export function applyReviewBatch(
  batch: ReviewBatchResponse,
  now: Date = new Date(),
) {
  return getDb().write((tx) => repo.applyReviewBatch(tx, batch, now.getTime()));
}

/** Adds or refreshes team records by id. */
export function addTeamRecords(
  records: readonly TeamRecord[],
  now: Date = new Date(),
) {
  if (!records.length) return Promise.resolve();
  return getDb().write((tx) => upsertTeamRecords(tx, records, now.getTime()));
}

/** Replaces the known verdicts with the server's list. */
export function replaceMyReviews(statuses: readonly MyReviewStatus[]) {
  return getDb().write((tx) => repo.replaceMyReviews(tx, statuses));
}

/**
 * Approves or rejects a queued record (see ReviewRepo.decideReview) and
 * wakes the outbox. False when the item isn't in the queue (already decided).
 */
export async function decideReview(
  itemId: string,
  outcome: ReviewOutcome,
  rejectReason?: RejectReason,
  now: Date = new Date(),
): Promise<boolean> {
  const decided = await getDb().write((tx) =>
    repo.decideReview(tx, itemId, outcome, rejectReason, now.getTime()),
  );
  if (decided) signalOutbox();
  return decided;
}
