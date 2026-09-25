import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { fill, formatClock, isSameLocalDay } from "@/helpers/format";
import type { CaptureSummary } from "@/types/Capture";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewItem,
  ReviewReason,
  ReviewReasonKind,
} from "@/types/Review";

/** The queue's filter pills. Heavy edits only show under "All reasons". */
export type ReviewFilter = "all" | "low_confidence" | "gps" | "duplicate";

export const REVIEW_FILTERS: readonly ReviewFilter[] = [
  "all",
  "low_confidence",
  "gps",
  "duplicate",
];

export const REJECT_REASONS: readonly RejectReason[] = [
  "wrong_class",
  "poor_photo",
  "bad_location",
  "duplicate",
  "other",
];

const FILTER_KIND: Record<Exclude<ReviewFilter, "all">, ReviewReasonKind> = {
  low_confidence: "low_confidence",
  gps: "gps_unverified",
  duplicate: "duplicate",
};

/** The filter's matches, newest first. */
export function filterReviews(
  items: readonly ReviewItem[],
  filter: ReviewFilter,
): ReviewItem[] {
  const matching =
    filter === "all"
      ? [...items]
      : items.filter((i) => i.reason.kind === FILTER_KIND[filter]);
  return matching.sort(
    (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
  );
}

/** "Low AI confidence (0.52)", "GPS unverified (±6.1 m draft)", … */
export function formatReviewReason(reason: ReviewReason): string {
  const r = strings.review.reasons;
  switch (reason.kind) {
    case "low_confidence":
      return fill(r.low_confidence, {
        confidence: reason.confidence.toFixed(2),
      });
    case "gps_unverified":
      return fill(r.gps_unverified, { accuracy: reason.accuracyM.toFixed(1) });
    case "heavy_edits":
      return fill(r.heavy_edits, {
        edited: reason.edited,
        total: reason.total,
      });
    case "duplicate":
      return fill(r.duplicate, { distance: reason.distanceM.toFixed(1) });
  }
}

/** "today 09:20", "yesterday", or "Mon 21 Sept". */
export function formatReviewWhen(at: Date, now: Date = new Date()): string {
  if (isSameLocalDay(at, now)) {
    return fill(strings.review.today, { time: formatClock(at) });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(at, yesterday)) return strings.review.yesterday;
  return at.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Enumerator 04 · today 09:20". */
export function formatReviewMeta(
  item: ReviewItem,
  now: Date = new Date(),
): string {
  return fill(strings.review.meta, {
    enumerator: item.enumerator,
    when: formatReviewWhen(new Date(item.capturedAt), now),
  });
}

/** The two-letter code on a card's tile, as in the asset IDs (EP-00412). */
export const CATEGORY_CODES: Record<AssetCategory, string> = {
  energy: "EP",
  water: "WS",
  telecom: "TC",
  roads: "RD",
};

/** One of the user's own records that went to a supervisor, and its verdict. */
export interface MyReview {
  capture: CaptureSummary;
  status: MyReviewStatus;
}

/**
 * The user's routed records, newest first: every flagged capture (waiting
 * until the server says otherwise) and any capture the server has a verdict
 * for. A verdict for a capture not on this device is left out.
 */
export function myReviews(
  captures: readonly CaptureSummary[],
  statuses: Readonly<Record<string, MyReviewStatus>>,
): MyReview[] {
  return captures
    .filter((c) => c.flagged || statuses[c.id])
    .map((capture) => ({
      capture,
      status: statuses[capture.id] ?? {
        captureId: capture.id,
        state: "waiting" as const,
      },
    }))
    .sort(
      (a, b) =>
        Date.parse(b.capture.capturedAt) - Date.parse(a.capture.capturedAt),
    );
}

/** Items decided on this device that the server hasn't confirmed yet. */
export function countUnsent(
  decisions: Readonly<Record<string, { syncStatus: string }>>,
): number {
  return Object.values(decisions).filter((d) => d.syncStatus !== "synced")
    .length;
}
