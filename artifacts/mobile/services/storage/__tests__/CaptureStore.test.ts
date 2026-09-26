import { captures, observations, outbox, attachments } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import { eq } from "drizzle-orm";
import { deletePole, saveCapture, saveCaptureEdit } from "../CaptureStore";
import {
  captureCounts,
  captureListQuery,
  captureRow,
  refreshCaptureStatus,
  upsertOwnCaptures,
} from "../repos/CaptureRepo";

jest.mock("@/services/sync/Outbox", () => ({
  ...jest.requireActual("@/services/sync/Outbox"),
  signalOutbox: jest.fn(),
}));
jest.mock("../ImageStore", () => ({
  deleteCaptureImage: jest.fn(),
  persistCaptureImage: (uri?: string) => uri,
}));
const { signalOutbox } = jest.requireMock("@/services/sync/Outbox");

const getDb = setupTestDatabase();
const orm = () => getDb().orm;

const summary = (
  id: string,
  over: Partial<CaptureSummary> = {},
): CaptureSummary => ({
  id,
  category: "water",
  title: "Borehole",
  capturedAt: "2026-09-23T10:14:03+03:00",
  accuracyM: 3.1,
  syncStatus: "pending",
  flagged: false,
  ...over,
});

const record = (id: string, poleIds: string[]): CaptureRecord => ({
  id,
  category: "water",
  title: "Borehole",
  capturedAt: "2026-09-23T10:14:03+03:00",
  photos: [{ uri: "file:///docs/captures/b.jpg" }],
  location: {
    latitude: 0.35,
    longitude: 32.58,
    accuracy: 3.1,
    altitude: null,
    satellites: null,
    flags: [],
  },
  attributes: [],
  statuses: ["good"],
  suggestedStatuses: [],
  functional: "yes",
  comment: "",
  poleIds,
});

const pole = (pid: string) => ({
  pid,
  latitude: 0.35,
  longitude: 32.58,
  timestamp: 1,
  category: "water" as const,
  imageUri: "file:///docs/captures/b.jpg",
});

async function saveOne(id = "c1", pids = ["c1", "c1-2"]) {
  return saveCapture({
    summary: summary(id),
    record: record(id, pids),
    poles: pids.map(pole),
  });
}

describe("saveCapture", () => {
  it("stores the poles, their uploads and photos, and the row in one transaction", async () => {
    await saveOne();
    expect(await orm().select().from(observations)).toHaveLength(2);
    expect((await orm().select().from(outbox)).map((o) => o.op)).toEqual([
      "insert",
      "insert",
    ]);
    expect(await orm().select().from(attachments)).toHaveLength(2);
    const [row] = await orm().select().from(captures);
    expect(row).toMatchObject({
      id: "c1",
      scope: "mine",
      syncStatus: "pending",
    });
    expect(row.record?.poleIds).toEqual(["c1", "c1-2"]);
    expect(signalOutbox).toHaveBeenCalled();
  });

  it("stores nothing when any part fails", async () => {
    await getDb().exec(
      "CREATE TRIGGER boom BEFORE INSERT ON captures BEGIN SELECT RAISE(ABORT, 'no'); END",
    );
    await expect(saveOne()).rejects.toThrow();
    expect(await orm().select().from(observations)).toEqual([]);
    expect(await orm().select().from(outbox)).toEqual([]);
  });
});

describe("saveCaptureEdit", () => {
  it("updates the record, sends it back to pending and queues the change for its poles", async () => {
    await saveOne();
    // As if uploaded: the outbox drained and the row settled.
    await getDb().write(async (tx) => {
      await tx.delete(outbox);
      await tx.delete(attachments);
      await refreshCaptureStatus(tx, ["c1"]);
    });
    expect((await orm().select().from(captures))[0].syncStatus).toBe("synced");

    const ok = await saveCaptureEdit("c1", {
      category: "water",
      statuses: ["leaking"],
      suggested: [],
      functional: "no",
      comment: " dripping ",
      duplicate: null,
      duplicateChoice: null,
    });

    expect(ok).toBe(true);
    const [row] = await orm().select().from(captures);
    expect(row.syncStatus).toBe("pending");
    expect(row.record).toMatchObject({
      statuses: ["leaking"],
      functional: "no",
      comment: "dripping",
    });
    const queued = await orm().select().from(outbox);
    expect(queued.map((o) => [o.entityId, o.op])).toEqual([
      ["c1", "update"],
      ["c1-2", "update"],
    ]);
    const [obs] = await orm()
      .select()
      .from(observations)
      .where(eq(observations.pid, "c1"));
    expect(obs.data).toMatchObject({ statuses: ["leaking"], functional: "no" });
    expect(obs.vc).toEqual({ [Object.keys(obs.vc)[0]]: 2 });
  });

  it("returns false for a record that isn't on the device", async () => {
    expect(
      await saveCaptureEdit("nope", {
        category: "water",
        statuses: [],
        suggested: [],
        functional: "unknown",
        comment: "",
        duplicate: null,
        duplicateChoice: null,
      }),
    ).toBe(false);
  });
});

describe("deletePole", () => {
  it("leaves a tombstone, queues the delete and cancels the photo upload", async () => {
    await saveOne("c1", ["c1"]);
    await getDb().write((tx) => tx.delete(outbox)); // the insert was delivered
    await deletePole("c1");
    const [obs] = await orm().select().from(observations);
    expect(obs).toMatchObject({ pid: "c1", deleted: true, synced: false });
    expect((await orm().select().from(outbox)).map((o) => o.op)).toEqual([
      "delete",
    ]);
    expect(await orm().select().from(attachments)).toEqual([]);
  });
});

describe("Records list (keyset pages) and counts", () => {
  const at = (i: number) =>
    new Date(Date.UTC(2026, 8, 1) + i * 60_000).toISOString();

  beforeEach(async () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      captureRow(
        summary(`c${String(i).padStart(3, "0")}`, {
          capturedAt: at(Math.floor(i / 2)), // pairs share a time: id breaks the tie
          syncStatus:
            i % 10 === 0 ? "failed" : i % 3 === 0 ? "pending" : "synced",
          flagged: i % 7 === 0,
          title: i === 42 ? "Special tap" : "Borehole",
        }),
        null,
        "mine",
        0,
      ),
    );
    await getDb().write((tx) => upsertOwnCaptures(tx, rows));
  });

  it("pages newest first without gaps or repeats, however ties fall", async () => {
    const q = captureListQuery("mine", "all", "");
    const seen: string[] = [];
    let after = null;
    for (;;) {
      const page = await q.page(orm(), after, 25);
      seen.push(...page.map((s) => s.id));
      if (page.length < 25) break;
      after = q.keyOf(page[page.length - 1]);
    }
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
    expect(seen[0]).toBe("c119");
    // Re-reading down to an anchor returns the same prefix.
    const anchor = q.keyOf((await q.page(orm(), null, 50))[49]);
    expect((await q.through(orm(), anchor)).map((s) => s.id)).toEqual(
      seen.slice(0, 50),
    );
  });

  it("filters by tab and search", async () => {
    const pending = await captureListQuery("mine", "pending", "").page(
      orm(),
      null,
      500,
    );
    expect(pending.every((s) => s.syncStatus !== "synced")).toBe(true);
    const found = await captureListQuery("mine", "all", "SPECIAL").page(
      orm(),
      null,
      500,
    );
    expect(found.map((s) => s.id)).toEqual(["c042"]);
  });

  it("counts every record in the scope from aggregates", async () => {
    const counts = await captureCounts(orm(), "mine");
    expect(counts.all).toBe(120);
    expect(counts.failed).toBe(12);
    expect(counts.pending).toBe(12 + 36);
    expect(counts.flagged).toBe(18);
    expect((await captureCounts(orm(), "team")).all).toBe(0);
  });
});
