import { captures, outbox, reviewDecisions, reviewItems } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import type { CaptureSummary } from "@/types/Capture";
import type { ReviewItem, TeamRecord } from "@/types/Review";
import { eq } from "drizzle-orm";
import { captureRow, upsertOwnCaptures } from "../repos/CaptureRepo";
import {
  lastReviewBatch,
  reviewCounts,
  reviewQueue,
} from "../repos/ReviewRepo";
import {
  applyReviewBatch,
  decideReview,
  replaceMyReviews,
} from "../ReviewStore";

const item = (
  id: string,
  captureId?: string,
  kind: "low_confidence" | "duplicate" = "low_confidence",
): ReviewItem => ({
  id,
  captureId,
  category: "roads",
  title: "Culvert · pipe",
  enumerator: "Enumerator 04",
  capturedAt: "2026-09-24T09:20:00.000Z",
  reason:
    kind === "duplicate" ? { kind, distanceM: 2 } : { kind, confidence: 0.52 },
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
const getDb = setupTestDatabase();
const orm = () => getDb().orm;

beforeEach(async () => {
  await getDb().write((tx) =>
    upsertOwnCaptures(tx, [
      captureRow(capture("c1"), null, "mine", 0),
      captureRow(capture("c2"), null, "mine", 0),
    ]),
  );
  await applyReviewBatch(
    { batchId: "b1", items: [item("a", "c1"), item("b")], records: [] },
    NOW,
  );
});

describe("ReviewStore", () => {
  it("approving takes the item off the queue, stores the decision and queues its upload", async () => {
    expect(await decideReview("a", "approved", undefined, NOW)).toBe(true);
    expect((await reviewQueue(orm(), "all")).map((i) => i.id)).toEqual(["b"]);
    expect(await orm().select().from(reviewDecisions)).toEqual([
      {
        itemId: "a",
        captureId: "c1",
        outcome: "approved",
        rejectReason: null,
        decidedAt: NOW.getTime(),
        syncStatus: "pending",
      },
    ]);
    const [row] = await orm().select().from(outbox);
    expect(row).toMatchObject({
      entity: "review_decision",
      entityId: "a",
      idempotencyKey: "review-a",
    });
    expect((await reviewCounts(orm())).unsent).toBe(1);
  });

  it("clears the flag on the reviewed capture only", async () => {
    await decideReview("a", "approved");
    const rows = await orm()
      .select({ id: captures.id, flagged: captures.flagged })
      .from(captures);
    expect(rows).toEqual([
      { id: "c1", flagged: false },
      { id: "c2", flagged: true },
    ]);
  });

  it("keeps the reason of a rejection", async () => {
    await decideReview("b", "rejected", "poor_photo");
    const [d] = await orm()
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.itemId, "b"));
    expect(d).toMatchObject({
      outcome: "rejected",
      rejectReason: "poor_photo",
    });
  });

  it("ignores an item that was already decided", async () => {
    await decideReview("a", "approved");
    expect(await decideReview("a", "rejected", "other")).toBe(false);
    expect(await orm().select().from(outbox)).toHaveLength(1);
  });

  it("never re-adds a decided item from a later batch, and remembers the batch", async () => {
    await decideReview("a", "approved");
    const team: TeamRecord = { summary: capture("t1"), record: null as never };
    await applyReviewBatch(
      {
        batchId: "b2",
        items: [item("a", "c1"), item("c", undefined, "duplicate")],
        records: [team],
      },
      NOW,
    );
    expect(
      (await orm().select().from(reviewItems)).map((i) => i.id).sort(),
    ).toEqual(["b", "c"]);
    expect(await lastReviewBatch(orm())).toEqual({
      id: "b2",
      downloadedAt: NOW.toISOString(),
      size: 2,
    });
    expect((await reviewQueue(orm(), "duplicate")).map((i) => i.id)).toEqual([
      "c",
    ]);
    const [t1] = await orm()
      .select()
      .from(captures)
      .where(eq(captures.id, "t1"));
    expect(t1.scope).toBe("team");
  });

  it("replaces the known verdicts", async () => {
    await replaceMyReviews([
      { captureId: "c1", state: "rejected", rejectReason: "poor_photo" },
    ]);
    await replaceMyReviews([{ captureId: "c2", state: "approved" }]);
    expect(await reviewCounts(orm())).toMatchObject({ rejected: 0 });
  });
});
