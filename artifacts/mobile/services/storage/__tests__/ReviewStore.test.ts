import type { CaptureSummary } from "@/types/Capture";
import type { ReviewItem } from "@/types/Review";
import { captures$, replaceCaptures } from "../CaptureStore";
import {
  clearReviews,
  decideReview,
  replaceReviewQueue,
  reviewDecisions$,
  reviewQueue$,
} from "../ReviewStore";

const item = (id: string, captureId?: string): ReviewItem => ({
  id,
  captureId,
  category: "roads",
  title: "Culvert · pipe",
  enumerator: "Enumerator 04",
  capturedAt: "2026-09-24T09:20:00.000Z",
  reason: { kind: "low_confidence", confidence: 0.52 },
});

const capture = (id: string): CaptureSummary => ({
  id,
  category: "roads",
  title: "Culvert · pipe",
  capturedAt: "2026-09-24T09:20:00.000Z",
  accuracyM: 3.6,
  syncStatus: "synced",
  flagged: true,
});

const NOW = new Date("2026-09-24T10:00:00.000Z");

beforeEach(() => {
  clearReviews();
  replaceCaptures([capture("c1"), capture("c2")]);
  replaceReviewQueue([item("a", "c1"), item("b")]);
});

describe("ReviewStore", () => {
  it("approving takes the item off the queue and queues the decision", () => {
    expect(decideReview("a", "approved", undefined, NOW)).toBe(true);
    expect(reviewQueue$.get().map((i) => i.id)).toEqual(["b"]);
    expect(reviewDecisions$.get().a).toEqual({
      itemId: "a",
      captureId: "c1",
      outcome: "approved",
      rejectReason: undefined,
      decidedAt: NOW.toISOString(),
      syncStatus: "pending",
    });
  });

  it("clears the flag on the reviewed capture only", () => {
    decideReview("a", "approved");
    expect(captures$.get().map((c) => c.flagged)).toEqual([false, true]);
  });

  it("keeps the reason of a rejection", () => {
    decideReview("b", "rejected", "poor_photo");
    expect(reviewDecisions$.get().b).toMatchObject({
      outcome: "rejected",
      rejectReason: "poor_photo",
    });
  });

  it("ignores an item that was already decided", () => {
    decideReview("a", "approved");
    const decisions = reviewDecisions$.get();
    expect(decideReview("a", "rejected", "other")).toBe(false);
    expect(reviewDecisions$.get()).toBe(decisions);
  });

  it("doesn't mutate what readers already hold", () => {
    const queue = reviewQueue$.get();
    decideReview("a", "approved");
    expect(queue.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
