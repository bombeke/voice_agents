import { isOnline$ } from "@/services/storage/NetworkState";
import {
  clearReviews,
  decideReview,
  myReviewStatus$,
  replaceReviewQueue,
  reviewBatch$,
  reviewDecisions$,
  reviewQueue$,
  teamRecords$,
} from "@/services/storage/ReviewStore";
import type { ReviewBatchResponse, ReviewItem } from "@/types/Review";
import {
  downloadReviewBatch,
  refreshMyReviews,
  uploadReviewDecisions,
} from "../ReviewSync";

const mockApi = { get: jest.fn(), patch: jest.fn() };
jest.mock("@/services/Api", () => ({
  axiosClient: {
    get: (...args: unknown[]) => mockApi.get(...args),
    patch: (...args: unknown[]) => mockApi.patch(...args),
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

const BATCH: ReviewBatchResponse = {
  batchId: "batch-1",
  items: [item(1), item(2)],
  records: [
    {
      summary: {
        id: "record-1",
        category: "roads",
        title: "Culvert 1",
        capturedAt: "2026-09-24T09:00:00.000Z",
        accuracyM: 3,
        syncStatus: "synced",
        flagged: true,
        capturedBy: { id: "enumerator-04", name: "Enumerator 04" },
      },
      record: { id: "record-1" } as never,
    },
  ],
};

const offlineError = () => Object.assign(new Error("Network Error"), {});
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  clearReviews();
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
    expect(reviewQueue$.get().map((i) => i.id)).toEqual(["item-1", "item-2"]);
    expect(teamRecords$.get()["record-1"].summary.capturedBy?.name).toBe(
      "Enumerator 04",
    );
    expect(reviewBatch$.get()).toMatchObject({ id: "batch-1", size: 2 });
  });

  it("keeps the queue one item per id and never re-adds a decided one", async () => {
    replaceReviewQueue([item(1)]);
    decideReview("item-1", "approved");
    mockApi.get.mockResolvedValue({ data: BATCH });
    await downloadReviewBatch();
    expect(reviewQueue$.get().map((i) => i.id)).toEqual(["item-2"]);
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
    replaceReviewQueue([item(3)]);
    mockApi.get.mockRejectedValue(httpError(500));
    await expect(downloadReviewBatch()).resolves.toEqual({
      ok: false,
      reason: "error",
    });
    expect(reviewQueue$.get()).toHaveLength(1);
  });
});

describe("uploadReviewDecisions", () => {
  beforeEach(() => replaceReviewQueue([item(1), item(2), item(3)]));

  it("sends each decision to its record and marks it synced", async () => {
    decideReview("item-1", "approved");
    decideReview("item-2", "rejected", "poor_photo");
    mockApi.patch.mockResolvedValue({ status: 200 });

    await expect(uploadReviewDecisions()).resolves.toBe(2);
    expect(mockApi.patch).toHaveBeenCalledWith(
      "/observations/v1/stream/record-2/review",
      expect.objectContaining({
        outcome: "rejected",
        rejectReason: "poor_photo",
      }),
    );
    expect(
      Object.values(reviewDecisions$.get()).map((d) => d.syncStatus),
    ).toEqual(["synced", "synced"]);
  });

  it("keeps decisions made offline until the next try", async () => {
    isOnline$.set(false);
    decideReview("item-1", "approved");
    await expect(uploadReviewDecisions()).resolves.toBe(0);
    expect(mockApi.patch).not.toHaveBeenCalled();
    expect(reviewDecisions$.get()["item-1"].syncStatus).toBe("pending");
  });

  it("stops at a lost connection and marks refused decisions failed", async () => {
    decideReview("item-1", "approved");
    decideReview("item-2", "approved");
    decideReview("item-3", "approved");
    mockApi.patch
      .mockRejectedValueOnce(httpError(409))
      .mockRejectedValueOnce(offlineError());

    await expect(uploadReviewDecisions()).resolves.toBe(0);
    const status = (id: string) => reviewDecisions$.get()[id].syncStatus;
    expect(status("item-1")).toBe("failed");
    expect(status("item-2")).toBe("pending");
    expect(status("item-3")).toBe("pending");
    expect(mockApi.patch).toHaveBeenCalledTimes(2);
  });
});

describe("refreshMyReviews", () => {
  it("replaces the known verdicts with the server's", async () => {
    mockApi.get.mockResolvedValue({
      data: [{ captureId: "c1", state: "rejected", rejectReason: "other" }],
    });
    await expect(refreshMyReviews()).resolves.toBe(true);
    expect(mockApi.get).toHaveBeenCalledWith("/review/v1/mine");
    expect(myReviewStatus$.get()).toEqual({
      c1: { captureId: "c1", state: "rejected", rejectReason: "other" },
    });
  });

  it("keeps the last known verdicts offline or on error", async () => {
    myReviewStatus$.set({ c1: { captureId: "c1", state: "waiting" } });
    isOnline$.set(false);
    await expect(refreshMyReviews()).resolves.toBe(false);
    isOnline$.set(true);
    mockApi.get.mockRejectedValue(httpError(500));
    await expect(refreshMyReviews()).resolves.toBe(false);
    expect(myReviewStatus$.get().c1.state).toBe("waiting");
  });
});
