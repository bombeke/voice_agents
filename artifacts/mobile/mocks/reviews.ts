import type { CaptureSummary } from "@/types/Capture";
import type { ReviewItem } from "@/types/Review";

type Row = Omit<ReviewItem, "id" | "captureId" | "capturedAt"> & {
  /** Hours before `now`, used when no fake capture matches the title. */
  hoursAgo: number;
};

/** The four records of design/screens/Supervisor review.png. */
const ROWS: Row[] = [
  {
    category: "roads",
    title: "Culvert · pipe",
    enumerator: "Enumerator 04",
    reason: { kind: "low_confidence", confidence: 0.52 },
    hoursAgo: 1,
  },
  {
    category: "water",
    title: "Public tap",
    enumerator: "Enumerator 02",
    reason: { kind: "gps_unverified", accuracyM: 6.1 },
    hoursAgo: 2,
  },
  {
    category: "energy",
    title: "Transformer",
    enumerator: "Enumerator 04",
    reason: { kind: "heavy_edits", edited: 4, total: 6 },
    hoursAgo: 26,
  },
  {
    category: "telecom",
    title: "Telecom pole",
    enumerator: "Enumerator 07",
    reason: { kind: "duplicate", distanceM: 1.8 },
    hoursAgo: 28,
  },
];

/**
 * The supervisor's queue in `start:mock`. Items whose title matches a fake
 * capture link to it (and take its time), so a card opens that record.
 */
export function fakeReviewQueue(
  captures: readonly CaptureSummary[],
  now: Date = new Date(),
): ReviewItem[] {
  return ROWS.map(({ hoursAgo, ...row }, i) => {
    const capture = captures.find(
      (c) => c.title === row.title && c.category === row.category,
    );
    return {
      ...row,
      id: `fake-review-${i + 1}`,
      captureId: capture?.id,
      capturedAt:
        capture?.capturedAt ??
        new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    };
  });
}
