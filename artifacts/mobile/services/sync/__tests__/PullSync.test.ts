import {
  attachments,
  captures,
  observations,
  outbox,
  syncState,
} from "@/db/schema";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import {
  deleteObservation,
  saveObservations,
} from "@/services/storage/repos/ObservationRepo";
import { eq } from "drizzle-orm";
import {
  applyChangesPage,
  normalizeRemotePole,
  pullObservations,
} from "../PullSync";

const NOW = 1_790_000_000_000;
const getDb = setupTestDatabase();
const orm = () => getDb().orm;

const remote = (pid: string, over: Record<string, unknown> = {}) => ({
  pid,
  latitude: 1,
  longitude: 2,
  updatedAt: new Date(NOW).toISOString(),
  deviceId: "dev-b",
  vc: { "dev-b": 1 },
  ...over,
});
const page = (items: unknown[], nextCursor = "c1", hasMore = false) => ({
  items,
  nextCursor,
  hasMore,
});
const apply = (p: ReturnType<typeof page>) =>
  getDb().write((tx) =>
    applyChangesPage(tx, p, { deviceId: "dev-a", now: NOW }),
  );
const row = async (pid: string) =>
  (await orm().select().from(observations).where(eq(observations.pid, pid)))[0];

describe("normalizeRemotePole", () => {
  it("reads ids, clocks and numbers the server sends as strings", () => {
    expect(
      normalizeRemotePole({
        id: 7,
        latitude: "1.5",
        longitude: "2",
        vc: '{"a":"3"}',
      }),
    ).toMatchObject({
      pid: "7",
      latitude: 1.5,
      vc: { a: 3 },
      deleted: false,
    });
  });

  it("drops rows without an id, and live rows it can't place", () => {
    expect(normalizeRemotePole({ latitude: 1, longitude: 2 })).toBeUndefined();
    expect(normalizeRemotePole({ pid: "x" })).toBeUndefined();
    expect(normalizeRemotePole({ pid: "x", deleted: "true" })).toMatchObject({
      deleted: true,
    });
  });
});

describe("applyChangesPage", () => {
  it("stores new records as synced and moves the cursor in the same transaction", async () => {
    await apply(page([remote("r1"), remote("r2")], "c2", true));
    expect((await row("r1")).synced).toBe(true);
    const [state] = await orm().select().from(syncState);
    expect(state).toMatchObject({ serverCursor: "c2", lastSyncedAt: null });
    await apply(page([], "c2", false));
    expect((await orm().select().from(syncState))[0].lastSyncedAt).toBe(NOW);
  });

  it("drops a queued upload the server has already superseded", async () => {
    await getDb().write((tx) =>
      saveObservations(
        tx,
        [{ pid: "p1", latitude: 1, longitude: 2, comment: "old" }],
        { deviceId: "dev-a", now: NOW - 10 },
      ),
    );
    await apply(
      page([
        remote("p1", { vc: { "dev-a": 1, "dev-b": 1 }, comment: "newer" }),
      ]),
    );
    expect(await orm().select().from(outbox)).toEqual([]);
    expect((await row("p1")).data).toMatchObject({ comment: "newer" });
  });

  it("keeps a local delete against an older version, and forgets a record deleted on the server", async () => {
    await getDb().write((tx) =>
      saveObservations(
        tx,
        [{ pid: "mine", latitude: 1, longitude: 2, imageUri: "file:///p.jpg" }],
        { deviceId: "dev-a", now: NOW - 10 },
      ),
    );
    await getDb().write((tx) =>
      deleteObservation(tx, "mine", { deviceId: "dev-a", now: NOW - 5 }),
    );
    await apply(page([remote("mine", { vc: { "dev-a": 1 } })]));
    expect((await row("mine")).deleted).toBe(true);

    await getDb().write((tx) =>
      saveObservations(
        tx,
        [{ pid: "gone", latitude: 1, longitude: 2, imageUri: "file:///g.jpg" }],
        { deviceId: "dev-a", now: NOW - 10 },
      ),
    );
    await getDb().write((tx) =>
      tx.delete(outbox).where(eq(outbox.entityId, "gone")),
    );
    const { released } = await apply(
      page([
        {
          pid: "gone",
          deleted: true,
          vc: { "dev-a": 1, "dev-b": 1 },
          updatedAt: new Date(NOW).toISOString(),
        },
      ]),
    );
    expect((await row("gone")).deleted).toBe(true);
    expect(released).toEqual(["file:///g.jpg"]);
    expect(
      await orm()
        .select()
        .from(attachments)
        .where(eq(attachments.entityId, "gone")),
    ).toEqual([]);
  });

  it("never stores a delete for a record it never had", async () => {
    await apply(page([{ pid: "never", deleted: true, vc: { x: 1 } }]));
    expect(await row("never")).toBeUndefined();
  });

  it("settles the Records row of a capture whose last upload the server confirms", async () => {
    await seedCaptures(getDb(), [
      {
        id: "c1",
        category: "energy",
        title: "Pole",
        capturedAt: new Date(NOW).toISOString(),
        accuracyM: 2,
        syncStatus: "pending",
        flagged: false,
      },
    ]);
    await getDb().write((tx) =>
      saveObservations(tx, [{ pid: "c1", latitude: 1, longitude: 2 }], {
        deviceId: "dev-a",
        now: NOW - 10,
        captureId: "c1",
      }),
    );
    const [queued] = await orm().select().from(outbox);
    // The server has our version and a newer one from another device.
    await apply(
      page([
        remote("c1", { vc: { ...(queued.payload.vc as object), "dev-b": 1 } }),
      ]),
    );
    expect((await orm().select().from(captures))[0].syncStatus).toBe("synced");
  });
});

it("pullObservations resumes from the stored cursor", async () => {
  const fetchPage = jest
    .fn()
    .mockResolvedValueOnce(page([remote("a")], "1", true))
    .mockRejectedValueOnce(new Error("offline"));
  await expect(
    pullObservations({ db: getDb(), fetchPage, deviceId: "dev-a" }),
  ).rejects.toThrow("offline");
  expect((await row("a")).pid).toBe("a");

  const resume = jest
    .fn()
    .mockResolvedValueOnce(page([remote("b")], "2", false));
  await pullObservations({ db: getDb(), fetchPage: resume, deviceId: "dev-a" });
  expect(resume).toHaveBeenCalledWith("1", 500);
});
