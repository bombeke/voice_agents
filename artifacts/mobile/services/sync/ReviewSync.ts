import { REVIEW_BATCH_SIZE } from "@/constants/Config";
import { peekDb } from "@/db/Current";
import { axiosClient } from "@/services/Api";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  addTeamRecords,
  applyReviewBatch,
  replaceMyReviews,
} from "@/services/storage/ReviewStore";
import type {
  MyReviewStatus,
  ReviewBatchResponse,
  TeamRecord,
} from "@/types/Review";

export const REVIEW_BATCH_URL = "/review/v1/batch";
export const MY_REVIEWS_URL = "/review/v1/mine";
/** Records of the enumerators assigned to this supervisor. */
export const TEAM_RECORDS_URL = "/records/v1/team";
/** Design-doc §8: supervisor approve or reject. */
export const reviewDecisionUrl = (recordId: string) =>
  `/observations/v1/stream/${encodeURIComponent(recordId)}/review`;

export type DownloadResult =
  { ok: true; added: number } | { ok: false; reason: "offline" | "error" };

/**
 * Downloads the next batch of records routed to this supervisor, with their
 * details, so they can be reviewed without a connection. Decisions go up
 * through the outbox (see SyncTransport).
 */
export async function downloadReviewBatch(
  limit: number = REVIEW_BATCH_SIZE,
): Promise<DownloadResult> {
  if (!isOnline$.peek() || !peekDb()) return { ok: false, reason: "offline" };
  try {
    const { data } = await axiosClient.get<ReviewBatchResponse>(
      REVIEW_BATCH_URL,
      { params: { limit } },
    );
    await applyReviewBatch(data);
    return { ok: true, added: data.items.length };
  } catch (err) {
    console.warn("[review] batch download failed", err);
    return { ok: false, reason: "error" };
  }
}

/** Fetches where the user's own routed records stand; keeps the last known offline. */
export async function refreshMyReviews(): Promise<boolean> {
  if (!isOnline$.peek() || !peekDb()) return false;
  try {
    const { data } = await axiosClient.get<MyReviewStatus[]>(MY_REVIEWS_URL);
    await replaceMyReviews(data);
    return true;
  } catch (err) {
    console.warn("[review] status refresh failed", err);
    return false;
  }
}

/**
 * Fetches the team's records for Records › Team, kept for offline use. False
 * offline or on error, leaving what was downloaded before.
 */
export async function refreshTeamRecords(): Promise<boolean> {
  if (!isOnline$.peek() || !peekDb()) return false;
  try {
    const { data } = await axiosClient.get<TeamRecord[]>(TEAM_RECORDS_URL);
    await addTeamRecords(data);
    return true;
  } catch (err) {
    console.warn("[records] team refresh failed", err);
    return false;
  }
}
