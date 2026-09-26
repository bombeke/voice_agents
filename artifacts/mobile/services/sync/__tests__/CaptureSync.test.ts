import { captures, outbox } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import { saveCapture } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  captureRow,
  upsertOwnCaptures,
} from "@/services/storage/repos/CaptureRepo";
import { deviceStatus$, resetSettings } from "@/services/storage/SettingsStore";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import { syncPendingCaptures } from "../CaptureSync";
import { startSync, stopSync } from "../SyncRuntime";

const mockPost = jest.fn();
jest.mock("@/services/Api", () => ({
  axiosClient: {
    post: (...a: unknown[]) => mockPost(...a),
    get: jest.fn(),
    put: jest.fn(),
  },
}));
jest.mock("@/services/storage/ImageStore", () => ({
  toFileUri: (u?: string) => u,
  persistCaptureImage: (u?: string) => u,
  deleteCaptureImage: jest.fn(),
}));

const summary = (
  id: string,
  syncStatus: CaptureSummary["syncStatus"] = "pending",
): CaptureSummary => ({
  id,
  category: "energy",
  title: "Concrete pole",
  capturedAt: "2026-09-23T10:14:03+03:00",
  accuracyM: 2.8,
  syncStatus,
  flagged: false,
});
const record = (id: string): CaptureRecord =>
  ({
    id,
    category: "energy",
    title: "Concrete pole",
    capturedAt: "2026-09-23T10:14:03+03:00",
    photos: [],
    poleIds: [id],
  }) as never;

/** A capture whose only pole has no photo, so the JSON push settles it. */
const save = (id: string) =>
  saveCapture({
    summary: summary(id),
    record: record(id),
    poles: [{ pid: id, latitude: 1, longitude: 2 }],
  });

const getDb = setupTestDatabase();
const statuses = async () =>
  Object.fromEntries(
    (
      await getDb()
        .orm.select({ id: captures.id, s: captures.syncStatus })
        .from(captures)
    ).map((r) => [r.id, r.s]),
  );
const httpError = (status?: number) =>
  Object.assign(
    new Error("HTTP"),
    status ? { response: { status, data: { detail: "no" } } } : {},
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  isOnline$.set(true);
  resetSettings();
  startSync(getDb());
});
afterEach(() => stopSync());

describe("syncPendingCaptures (Sync now)", () => {
  it("pushes each record with its idempotency key and marks the row synced", async () => {
    mockPost.mockResolvedValue({ status: 200, data: {} });
    await save("a");
    await syncPendingCaptures();

    expect(mockPost).toHaveBeenCalledWith(
      "/observations/v1/stream",
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(/^pole-a-.+-1$/),
        }),
      }),
    );
    expect(await statuses()).toEqual({ a: "synced" });
    expect(await getDb().orm.select().from(outbox)).toEqual([]);
    expect(deviceStatus$.lastSyncedAt.get()).toEqual(expect.any(String));
  });

  it("keeps records pending offline, and a refused one failed until the next Sync now", async () => {
    await save("a");
    await save("b");
    mockPost.mockRejectedValue(httpError());
    await syncPendingCaptures();
    expect(await statuses()).toEqual({ a: "pending", b: "pending" });
    expect(deviceStatus$.lastSyncedAt.get()).toBeUndefined();

    mockPost.mockReset();
    mockPost
      .mockRejectedValueOnce(httpError(422))
      .mockResolvedValue({ status: 200 });
    await syncPendingCaptures();
    expect(await statuses()).toEqual({ a: "failed", b: "synced" });

    mockPost.mockResolvedValue({ status: 200 });
    await syncPendingCaptures();
    expect(await statuses()).toEqual({ a: "synced", b: "synced" });
  });

  it("shares one run between concurrent callers", async () => {
    mockPost.mockResolvedValue({ status: 200 });
    await save("a");
    const one = syncPendingCaptures();
    const two = syncPendingCaptures();
    expect(two).toBe(one);
    await one;
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("settles rows that have nothing queued (e.g. from before the outbox)", async () => {
    await getDb().write((tx) =>
      upsertOwnCaptures(tx, [captureRow(summary("old"), null, "mine", 0)]),
    );
    await syncPendingCaptures();
    expect(await statuses()).toEqual({ old: "synced" });
  });
});
