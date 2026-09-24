import { REVIEW_BATCH_SIZE } from "@/constants/Config";
import { axiosClient } from "@/services/Api";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  applyReviewBatch,
  replaceMyReviews,
  setDecisionStatus,
  unsentDecisions,
} from "@/services/storage/ReviewStore";
import type { MyReviewStatus, ReviewBatchResponse } from "@/types/Review";

export const REVIEW_BATCH_URL = "/review/v1/batch";
export const MY_REVIEWS_URL = "/review/v1/mine";
/** Design-doc §8: supervisor approve or reject. */
export const reviewDecisionUrl = (recordId: string) =>
  `/observations/v1/stream/${encodeURIComponent(recordId)}/review`;

export type DownloadResult =
  { ok: true; added: number } | { ok: false; reason: "offline" | "error" };

/**
 * Downloads the next batch of records routed to this supervisor, with their
 * details, so they can be reviewed without a connection.
 */
export async function downloadReviewBatch(
  limit: number = REVIEW_BATCH_SIZE,
): Promise<DownloadResult> {
  if (!isOnline$.peek()) return { ok: false, reason: "offline" };
  try {
    const { data } = await axiosClient.get<ReviewBatchResponse>(
      REVIEW_BATCH_URL,
      { params: { limit } },
    );
    applyReviewBatch(data);
    return { ok: true, added: data.items.length };
  } catch (err) {
    console.warn("[review] batch download failed", err);
    return { ok: false, reason: "error" };
  }
}

let uploading: Promise<number> | null = null;

async function uploadAll(): Promise<number> {
  let sent = 0;
  for (const decision of unsentDecisions()) {
    // Items from before batches existed don't name a server record.
    if (!decision.captureId) {
      setDecisionStatus(decision.itemId, "synced");
      continue;
    }
    setDecisionStatus(decision.itemId, "uploading");
    try {
      await axiosClient.patch(reviewDecisionUrl(decision.captureId), {
        outcome: decision.outcome,
        rejectReason: decision.rejectReason,
        decidedAt: decision.decidedAt,
      });
      setDecisionStatus(decision.itemId, "synced");
      sent++;
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;
      // No answer: offline or timed out, so the rest wait for the next try.
      if (!status) {
        setDecisionStatus(decision.itemId, "pending");
        break;
      }
      // Refused (e.g. another supervisor decided first): keep it to show.
      setDecisionStatus(decision.itemId, "failed");
      console.warn("[review] decision rejected", status, decision.itemId);
    }
  }
  return sent;
}

/**
 * Sends decisions made offline, oldest first. Concurrent callers share one
 * run; returns how many the server accepted.
 */
export function uploadReviewDecisions(): Promise<number> {
  if (!isOnline$.peek()) return Promise.resolve(0);
  uploading ??= uploadAll().finally(() => {
    uploading = null;
  });
  return uploading;
}

/** Fetches where the user's own routed records stand; keeps the last known offline. */
export async function refreshMyReviews(): Promise<boolean> {
  if (!isOnline$.peek()) return false;
  try {
    const { data } = await axiosClient.get<MyReviewStatus[]>(MY_REVIEWS_URL);
    replaceMyReviews(data);
    return true;
  } catch (err) {
    console.warn("[review] status refresh failed", err);
    return false;
  }
}
