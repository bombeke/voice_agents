import { captures, reviewDecisions, reviewStatus } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import { isOnline$ } from "@/services/storage/NetworkState";
import { reviewQueue } from "@/services/storage/repos/ReviewRepo";
import { applyReviewBatch, decideReview } from "@/services/storage/ReviewStore";
import type { ReviewBatchResponse, ReviewItem } from "@/types/Review";
import { eq } from "drizzle-orm";
import { drainOutbox } from "../OutboxWorker";
import {
  downloadReviewBatch,
  refreshMyReviews,
  refreshTeamRecords,
} from "../ReviewSync";
import { outboxHandlers } from "../SyncTransport";

const mockApi = { get: jest.fn(), patch: jest.fn(), post: jest.fn() };
jest.mock("@/services/Api", () => ({
  axiosClient: {
    get: (...args: unknown[]) => mockApi.get(...args),
    patch: (...args: unknown[]) => mockApi.patch(...args),
    post: (...args: unknown[]) => mockApi.post(...args),
  },
}));

const item = (n: number): ReviewItem => ({
  id: `item-${n}`,
  captureId: `record-${n}`,
  category: "roads",
  title: `Culvert ${n}`,
  enumerator: "Enumerator 04",
  capturedAt: "2026-09-24T09:00:00.000Z",
  reason: { kind: "low_confidence", confidence: 0.5 },
});

const teamRecord = (id: string) => ({
  summary: {
    id,
    category: "roads" as const,
    title: "Culvert 1",
    capturedAt: "2026-09-24T09:00:00.000Z",
    accuracyM: 3,
    syncStatus: "synced" as const,
    flagged: true,
    capturedBy: { id: "enumerator-04", name: "Enumerator 04" },
  },
  record: { id } as never,
});

const BATCH: ReviewBatchResponse = {
  batchId: "batch-1",
  items: [item(1), item(2)],
  records: [teamRecord("record-1")],
};

const httpError = (status?: number) =>
  Object.assign(
    new Error(status ? `HTTP ${status}` : "Network Error"),
    status ? { response: { status } } : {},
  );

const getDb = setupTestDatabase();
const orm = () => getDb().orm;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  isOnline$.set(true);
});

describe("downloadReviewBatch", () => {
  it("adds the batch's items and records for offline review", async () => {
    mockApi.get.mockResolvedValue({ data: BATCH });
    await expect(downloadReviewBatch(20)).resolves.toEqual({
      ok: true,
      added: 2,
    });
    expect(mockApi.get).toHaveBeenCalledWith("/review/v1/batch", {
      params: { limit: 20 },
    });
    expect((await reviewQueue(orm(), "all")).map((i) => i.id).sort()).toEqual([
      "item-1",
      "item-2",
    ]);
    const [team] = await orm()
      .select()
      .from(captures)
      .where(eq(captures.id, "record-1"));
    expect(team).toMatchObject({ scope: "team" });
    expect(team.summary.capturedBy?.name).toBe("Enumerator 04");
  });

  it("does nothing offline", async () => {
    isOnline$.set(false);
    await expect(downloadReviewBatch()).resolves.toEqual({
      ok: false,
      reason: "offline",
    });
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("reports a failed download and keeps the queue", async () => {
    await applyReviewBatch({ batchId: "b0", items: [item(9)], records: [] });
    mockApi.get.mockRejectedValue(httpError(500));
    await expect(downloadReviewBatch()).resolves.toEqual({
      ok: false,
      reason: "error",
    });
    expect((await reviewQueue(orm(), "all")).map((i) => i.id)).toEqual([
      "item-9",
    ]);
  });
});

describe("decisions through the outbox", () => {
  beforeEach(() => applyReviewBatch(BATCH));

  it("sends each decision to its record with an idempotency key, and marks it synced", async () => {
    await decideReview("item-1", "rejected", "poor_photo");
    mockApi.patch.mockResolvedValue({ status: 200 });

    await drainOutbox(getDb(), outboxHandlers);

    expect(mockApi.patch).toHaveBeenCalledWith(
      "/observations/v1/stream/record-1/review",
      expect.objectContaining({
        outcome: "rejected",
        rejectReason: "poor_photo",
      }),
      { headers: { "Idempotency-Key": "review-item-1" } },
    );
    const [d] = await orm().select().from(reviewDecisions);
    expect(d.syncStatus).toBe("synced");
  });

  it("keeps a decision made offline for the next try, and marks a refused one failed", async () => {
    await decideReview("item-1", "approved");
    await decideReview("item-2", "approved");
    mockApi.patch.mockRejectedValueOnce(httpError());
    const offline = await drainOutbox(getDb(), outboxHandlers);
    expect(offline.deferred).toBe(true);
    expect(
      (await orm().select().from(reviewDecisions)).map((d) => d.syncStatus),
    ).toEqual(["pending", "pending"]);

    // Another supervisor decided item-1 first: kept, shown as failed.
    mockApi.patch
      .mockRejectedValueOnce(httpError(409))
      .mockResolvedValue({ status: 200 });
    await drainOutbox(getDb(), outboxHandlers, {
      now: () => Date.now() + 3_600_000,
    });
    const byId = Object.fromEntries(
      (await orm().select().from(reviewDecisions)).map((d) => [
        d.itemId,
        d.syncStatus,
      ]),
    );
    expect(byId).toEqual({ "item-1": "failed", "item-2": "synced" });
  });
});

describe("refreshMyReviews", () => {
  it("replaces the known verdicts with the server's", async () => {
    mockApi.get.mockResolvedValue({
      data: [{ captureId: "c1", state: "rejected", rejectReason: "other" }],
    });
    await expect(refreshMyReviews()).resolves.toBe(true);
    expect(
      await orm().select({ id: reviewStatus.captureId }).from(reviewStatus),
    ).toEqual([{ id: "c1" }]);
  });

  it("keeps the last known verdicts offline or on error", async () => {
    mockApi.get.mockResolvedValue({
      data: [{ captureId: "c1", state: "approved" }],
    });
    await refreshMyReviews();
    isOnline$.set(false);
    await expect(refreshMyReviews()).resolves.toBe(false);
    isOnline$.set(true);
    mockApi.get.mockRejectedValue(httpError(500));
    await expect(refreshMyReviews()).resolves.toBe(false);
    expect(await orm().select().from(reviewStatus)).toHaveLength(1);
  });
});

describe("refreshTeamRecords", () => {
  it("keeps the team's records for offline use, and what it had on error", async () => {
    mockApi.get.mockResolvedValue({
      data: [teamRecord("t1"), teamRecord("t2")],
    });
    await expect(refreshTeamRecords()).resolves.toBe(true);
    mockApi.get.mockRejectedValue(httpError(500));
    await expect(refreshTeamRecords()).resolves.toBe(false);
    expect(
      await orm()
        .select({ id: captures.id })
        .from(captures)
        .where(eq(captures.scope, "team")),
    ).toHaveLength(2);
  });
});
