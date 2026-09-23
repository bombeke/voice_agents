import { captures$, replaceCaptures } from "@/services/storage/CaptureStore";
import {
  failedOps$,
  opQueue$,
  replayOpQueue,
  retryFailedOps,
} from "@/services/storage/LegendState";
import type { CaptureSummary, CaptureSyncStatus } from "@/types/Capture";
import {
  type CaptureUploader,
  setCaptureUploader,
  syncPendingCaptures,
} from "../CaptureSync";

jest.mock("@/services/storage/LegendState", () => {
  const { observable } = require("@legendapp/state");
  return {
    opQueue$: observable([]),
    failedOps$: observable([]),
    replayOpQueue: jest.fn(async () => ({ ok: true })),
    retryFailedOps: jest.fn(),
  };
});

const record = (id: string, syncStatus: CaptureSyncStatus): CaptureSummary => ({
  id,
  category: "energy",
  title: "Concrete pole",
  capturedAt: "2026-09-23T10:14:03+03:00",
  accuracyM: 2.8,
  syncStatus,
  flagged: false,
});

const statuses = () =>
  Object.fromEntries(captures$.get().map((c) => [c.id, c.syncStatus]));

beforeEach(() => {
  jest.clearAllMocks();
  setCaptureUploader();
  opQueue$.set([]);
  failedOps$.set([]);
  replaceCaptures([
    record("a", "pending"),
    record("b", "failed"),
    record("c", "synced"),
    record("d", "uploading"),
  ]);
});

describe("syncPendingCaptures", () => {
  it("marks every unsynced record uploading, then applies the result", async () => {
    let seen: Record<string, CaptureSyncStatus> = {};
    const uploader: CaptureUploader = jest.fn(async (due) => {
      seen = statuses();
      expect(due.map((c) => c.id)).toEqual(["a", "b", "d"]);
      return { synced: ["a"], failed: ["b"] };
    });
    setCaptureUploader(uploader);

    await syncPendingCaptures();

    expect(seen).toEqual({
      a: "uploading",
      b: "uploading",
      c: "synced",
      d: "uploading",
    });
    // "d" was neither synced nor failed, so it waits for the next try.
    expect(statuses()).toEqual({
      a: "synced",
      b: "failed",
      c: "synced",
      d: "pending",
    });
  });

  it("marks the batch failed when the uploader throws", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    setCaptureUploader(async () => {
      throw new Error("boom");
    });
    await syncPendingCaptures();
    expect(statuses()).toMatchObject({ a: "failed", b: "failed", d: "failed" });
  });

  it("shares one run between concurrent callers", async () => {
    const uploader = jest.fn(async () => ({ synced: [], failed: [] }));
    setCaptureUploader(uploader);
    const first = syncPendingCaptures();
    expect(syncPendingCaptures()).toBe(first);
    await first;
    expect(uploader).toHaveBeenCalledTimes(1);
  });

  it("does nothing when everything is synced", async () => {
    const uploader = jest.fn();
    setCaptureUploader(uploader);
    replaceCaptures([record("c", "synced")]);
    await syncPendingCaptures();
    expect(uploader).not.toHaveBeenCalled();
  });

  it("reads each record's state off the op queue by default", async () => {
    opQueue$.set([{ recordLocalId: "a" }] as never);
    failedOps$.set([{ recordLocalId: "b" }] as never);

    await syncPendingCaptures();

    expect(retryFailedOps).toHaveBeenCalled();
    expect(replayOpQueue).toHaveBeenCalled();
    expect(statuses()).toEqual({
      a: "pending",
      b: "failed",
      c: "synced",
      d: "synced",
    });
  });
});
