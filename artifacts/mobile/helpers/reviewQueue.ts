import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { fill, formatClock, isSameLocalDay } from "@/helpers/format";
import type {
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
function formatWhen(at: Date, now: Date): string {
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
    when: formatWhen(new Date(item.capturedAt), now),
  });
}

/** The two-letter code on a card's tile, as in the asset IDs (EP-00412). */
export const CATEGORY_CODES: Record<AssetCategory, string> = {
  energy: "EP",
  water: "WS",
  telecom: "TC",
  roads: "RD",
};
