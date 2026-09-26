import type { Database } from "@/db/Database";
import {
  captures,
  mapAssets,
  observations,
  outbox,
  reviewDecisions,
  reviewItems,
  syncState,
  trackPoints,
} from "@/db/schema";
import { openNodeDatabase } from "@/db/testing/NodeDatabase";
import { fakeMapAssets } from "@/mocks/assets";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import { eq } from "drizzle-orm";
import {
  IMPORT_MARKER,
  importLegacyData,
  LEGACY_DEVICE_KEYS,
  LEGACY_KEYS,
  type LegacySource,
} from "../LegacyImport";

const NOW = Date.parse("2026-09-25T10:00:00.000Z");

class MemorySource implements LegacySource {
  data = new Map<string, string>();
  constructor(entries: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(entries))
      this.data.set(k, JSON.stringify(v));
  }
  getString(key: string) {
    return this.data.get(key);
  }
  remove(key: string) {
    this.data.delete(key);
  }
}

const summary = (
  id: string,
  over: Partial<CaptureSummary> = {},
): CaptureSummary => ({
  id,
  category: "energy",
  title: "Concrete pole",
  capturedAt: "2026-09-24T09:00:00.000Z",
  accuracyM: 2.8,
  syncStatus: "pending",
  flagged: false,
  ...over,
});

const record = (id: string, poleIds: string[]): CaptureRecord => ({
  id,
  category: "energy",
  title: "Concrete pole",
  capturedAt: "2026-09-24T09:00:00.000Z",
  photos: [{ uri: "file:///docs/captures/1.jpg" }],
  location: {
    latitude: 0.35,
    longitude: 32.58,
    accuracy: 2.8,
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

const pole = (pid: string, over: Record<string, unknown> = {}) => ({
  pid,
  latitude: 0.35,
  longitude: 32.58,
  timestamp: NOW - 86_400_000,
  category: "energy",
  imageUri: "file:///docs/captures/1.jpg",
  synced: false,
  updatedAt: "2026-09-24T09:00:00.000Z",
  deviceId: "dev-a",
  vc: { "dev-a": 1 },
  ...over,
});

/** A device as a build before SQLite left it. */
function legacyUserStore() {
  return new MemorySource({
    [LEGACY_KEYS.captures]: [
      summary("c1", { syncStatus: "uploading" }),
      summary("c2", { syncStatus: "synced", assetId: "EP-00412" }),
    ],
    [LEGACY_KEYS.records]: {
      c1: record("c1", ["c1", "p2"]),
      c2: record("c2", ["c2"]),
    },
    [LEGACY_KEYS.poles]: {
      poles: [
        pole("c1"),
        pole("c2", { synced: true, imageUri: "https://files.test/c2.jpg" }),
        // A batch older builds spread into one record: recovered.
        { 0: pole("p2") },
      ],
      tombstones: {
        gone: {
          pid: "gone",
          vc: { "dev-a": 3 },
          updatedAt: "2026-09-24T08:00:00.000Z",
          deviceId: "dev-a",
        },
      },
      tracks: [{ lat: 0.35, lng: 32.58, timestamp: 1 }],
    },
    [LEGACY_KEYS.opQueue]: [
      {
        opId: "op-1",
        kind: "create",
        recordLocalId: "c1",
        payload: pole("c1"),
        idempotencyKey: "pole-c1-dev-a-1",
        attempts: 2,
        timestamp: "2026-09-24T09:00:01.000Z",
      },
      {
        opId: "op-2",
        kind: "create",
        recordLocalId: "p2",
        payload: pole("p2"),
        idempotencyKey: "pole-p2-dev-a-1",
      },
      {
        opId: "op-3",
        kind: "delete",
        recordLocalId: "gone",
        payload: { pid: "gone", vc: { "dev-a": 3 } },
        idempotencyKey: "pole-gone-dev-a-3",
      },
      // Not a pole op (a DHIS2 event): not deliverable by the new outbox.
      {
        opId: "op-4",
        kind: "create",
        recordLocalId: "evt",
        payload: { event: "x" },
      },
    ],
    [LEGACY_KEYS.reviewQueue]: [
      {
        id: "r1",
        captureId: "t1",
        category: "water",
        title: "Tap",
        enumerator: "E1",
        capturedAt: "2026-09-24T07:00:00.000Z",
        reason: { kind: "duplicate", distanceM: 2 },
      },
      {
        id: "r2",
        captureId: "t2",
        category: "water",
        title: "Tap",
        enumerator: "E1",
        capturedAt: "2026-09-24T07:00:00.000Z",
        reason: { kind: "duplicate", distanceM: 2 },
      },
    ],
    [LEGACY_KEYS.reviewDecisions]: {
      r2: {
        itemId: "r2",
        captureId: "t2",
        outcome: "approved",
        decidedAt: "2026-09-24T08:00:00.000Z",
        syncStatus: "pending",
      },
    },
    [LEGACY_KEYS.auditLog]: [
      { type: "POLE_UPSERT", payload: { pid: "c1" }, ts: 1 },
    ],
  });
}

describe("importLegacyData", () => {
  let db: Database;
  beforeEach(async () => {
    db = await openNodeDatabase();
  });
  afterEach(() => db.close());

  it("moves every store into SQLite and removes the blobs", async () => {
    const user = legacyUserStore();
    const device = new MemorySource({
      [LEGACY_DEVICE_KEYS.mapAssets]: fakeMapAssets(new Date(NOW)).slice(0, 3),
    });

    const { imported, counts } = await importLegacyData(db, user, device, {
      now: NOW,
      deviceId: "dev-a",
    });

    expect(imported).toBe(true);
    expect(counts).toMatchObject({
      captures: 2,
      observations: 4,
      outbox: 4,
      attachments: 2,
    });

    // Captures, their details, and poles linked to them.
    const rows = await db.orm.select().from(captures);
    expect(rows.map((r) => [r.id, r.syncStatus])).toEqual(
      expect.arrayContaining([
        ["c1", "pending"], // cut off mid-upload: back to pending
        ["c2", "synced"],
      ]),
    );
    expect(rows.find((r) => r.id === "c1")?.record?.poleIds).toEqual([
      "c1",
      "p2",
    ]);
    const obs = await db.orm.select().from(observations);
    expect(
      obs.map((o) => [o.pid, o.captureId, o.deleted, o.synced]).sort(),
    ).toEqual([
      ["c1", "c1", false, false],
      ["c2", "c2", false, true],
      ["gone", null, true, false],
      ["p2", "c1", false, false],
    ]);

    // Queued uploads keep their idempotency keys; the review decision joins them.
    const queued = await db.orm.select().from(outbox);
    expect(
      queued.map((o) => [o.entity, o.entityId, o.op, o.idempotencyKey]).sort(),
    ).toEqual([
      ["observation", "c1", "insert", "pole-c1-dev-a-1"],
      ["observation", "gone", "delete", "pole-gone-dev-a-3"],
      ["observation", "p2", "insert", "pole-p2-dev-a-1"],
      ["review_decision", "r2", "insert", "review-r2"],
    ]);
    expect(queued.find((o) => o.entityId === "c1")?.attemptCount).toBe(2);

    // Decided items don't return to the queue.
    expect((await db.orm.select().from(reviewItems)).map((i) => i.id)).toEqual([
      "r1",
    ]);
    expect(await db.orm.select().from(reviewDecisions)).toHaveLength(1);
    expect(await db.orm.select().from(trackPoints)).toHaveLength(1);
    expect(await db.orm.select().from(mapAssets)).toHaveLength(3);

    // Blobs gone from the user's store; the device-wide map cache stays for other users.
    expect(user.data.size).toBe(0);
    expect(device.data.has(LEGACY_DEVICE_KEYS.mapAssets)).toBe(true);
  });

  it("is idempotent: a second run imports nothing and changes nothing", async () => {
    await importLegacyData(db, legacyUserStore(), null, {
      now: NOW,
      deviceId: "dev-a",
    });
    const before = await db.exec("SELECT count(*) AS n FROM outbox");

    // Blobs left behind (say, a crash after COMMIT, before the keys were removed).
    const leftovers = legacyUserStore();
    const again = await importLegacyData(db, leftovers, null, {
      now: NOW + 1,
      deviceId: "dev-a",
    });

    expect(again.imported).toBe(false);
    expect(await db.exec("SELECT count(*) AS n FROM outbox")).toEqual(before);
    expect(leftovers.data.size).toBe(0);
  });

  it("does not overwrite edits made since the import when re-run", async () => {
    await importLegacyData(db, legacyUserStore(), null, {
      now: NOW,
      deviceId: "dev-a",
    });
    await db.write((tx) =>
      tx.update(captures).set({ flagged: true }).where(eq(captures.id, "c1")),
    );
    await importLegacyData(db, legacyUserStore(), null, {
      now: NOW,
      deviceId: "dev-a",
    });
    const [c1] = await db.orm
      .select()
      .from(captures)
      .where(eq(captures.id, "c1"));
    expect(c1.flagged).toBe(true);
  });

  it("leaves no trace when it fails mid-import, and succeeds on the next run", async () => {
    const user = legacyUserStore();
    // Break the transaction after most writes: the marker insert collides.
    await db.exec(
      "CREATE TRIGGER boom BEFORE INSERT ON sync_state WHEN NEW.collection = 'legacy_import_v1' BEGIN SELECT RAISE(ABORT, 'crash'); END",
    );

    // Drizzle wraps the driver's error ("Failed query: …"); the cause is ours.
    const failure = await importLegacyData(db, user, null, {
      now: NOW,
      deviceId: "dev-a",
    }).catch((e) => e);
    expect(String(failure?.cause ?? failure)).toContain("crash");
    expect(await db.orm.select().from(captures)).toEqual([]);
    expect(await db.orm.select().from(outbox)).toEqual([]);
    expect(user.data.size).toBeGreaterThan(0); // Blobs kept for the retry.

    await db.exec("DROP TRIGGER boom");
    const retry = await importLegacyData(db, user, null, {
      now: NOW,
      deviceId: "dev-a",
    });
    expect(retry.imported).toBe(true);
    expect(await db.orm.select().from(captures)).toHaveLength(2);
    const [marker] = await db.orm
      .select()
      .from(syncState)
      .where(eq(syncState.collection, IMPORT_MARKER));
    expect(marker.lastSyncedAt).toBe(NOW);
  });

  it("imports an empty or unreadable store without failing", async () => {
    const junk = new MemorySource();
    junk.data.set(LEGACY_KEYS.captures, "{not json");
    const { imported, counts } = await importLegacyData(db, junk, null, {
      now: NOW,
      deviceId: "dev-a",
    });
    expect(imported).toBe(true);
    expect(counts.captures).toBe(0);
    expect(await db.orm.select().from(captures)).toEqual([]);
  });
});
