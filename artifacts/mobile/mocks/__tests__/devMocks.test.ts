import type { Claims } from "@/types/Auth";
import { jwtDecode } from "jwt-decode";
import { DEV_MOCKS_MARKER, devMocks, FAKE_SSO_CODE } from "..";
import { nearbyAssets } from "@/services/capture/NearbyAssets";
import { speechToText } from "@/services/capture/SpeechToText";
import { peekDb, setDatabaseFactory } from "@/db/Current";
import { captures, mapAssets, reviewItems } from "@/db/schema";
import { openNodeDatabase } from "@/db/testing/NodeDatabase";
import { seedCaptures } from "@/db/testing/TestDb";
import { gnssStatus$ } from "@/services/storage/CaptureStore";
import {
  closeUserData,
  openUserData,
  userStorageId,
} from "@/services/storage/UserData";
import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deviceStatus$ } from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { accountStore } from "../AccountStore";
import { resetReviewServer } from "../reviewServer";
import { FAKE_CAPTURE_PREFIX, fakeCaptures } from "../captures";
import { devMocks as stub } from "../stub";

jest.mock("@/services/Api", () => ({
  axiosClient: require("axios").create({ baseURL: "https://api.test" }),
  queryClient: new (require("@tanstack/react-query").QueryClient)(),
}));
// The upload workers need the device's files; these tests drive the fake
// server through axios instead.
jest.mock("@/services/sync/SyncRuntime", () => ({
  ...jest.requireActual("@/services/sync/SyncRuntime"),
  startSync: jest.fn(),
  stopSync: jest.fn(async () => undefined),
}));

// The per-user database key lives in the keystore.
jest.mock("@/services/AuthHelpers", () => {
  const secrets = new Map<string, string>();
  return {
    getSecret: async (key: string) => secrets.get(key) ?? null,
    saveSecret: async (key: string, value: string) => {
      secrets.set(key, value);
    },
  };
});

const { axiosClient } = jest.requireMock("@/services/Api");

const FIELD = { id: "field", name: "Field Enumerator" };
const SUPERVISOR = { id: "supervisor", name: "Area Supervisor" };

let dir: string;
beforeAll(async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  dir = mkdtempSync(join(tmpdir(), "devmocks-"));
  setDatabaseFactory((userId) =>
    openNodeDatabase(join(dir, `${userStorageId(userId)}.db`)),
  );
  devMocks.install();
  await openUserData(FIELD);
});
beforeEach(() => accountStore.clear());
// Also clears the query client, whose cache timers would keep Jest running.
afterAll(async () => {
  await closeUserData();
  setDatabaseFactory(null);
  rmSync(dir, { recursive: true, force: true });
});

const db = () => peekDb()!;
const ownRows = async () =>
  (
    await db().orm.select().from(captures).where(eq(captures.scope, "mine"))
  ).map((r) => r);
const seededRows = async () =>
  (await ownRows()).filter((r) => r.id.startsWith(FAKE_CAPTURE_PREFIX));

const SIGN_UP = {
  name: "Grace Nakato",
  email: "grace@uedcl.example.org",
  phone: "+256700123456",
  password: "fieldwork2026",
};

async function post(url: string, data: object) {
  try {
    const res = await axiosClient.post(url, data);
    return { status: res.status as number, data: res.data };
  } catch (err: any) {
    return { status: err.response?.status as number, data: err.response?.data };
  }
}

describe("dev mocks", () => {
  it("is null in the stub that release bundles get", () => {
    expect(stub).toBeNull();
  });

  it("seeds the signed-in enumerator's captures, with details, and the GNSS state", async () => {
    const seeded = await seededRows();
    expect(seeded).toHaveLength(14);
    expect(seeded[0].summary.capturedBy).toEqual(FIELD);
    expect(seeded.find((r) => r.id === "fake-capture-1")?.record).toBeTruthy();
    // Plus the earlier inspection in EP-00412's condition history.
    expect(await ownRows()).toHaveLength(15);
    expect(gnssStatus$.get()).toEqual({ bands: "L1+L5", ok: true });
  });

  it("links seeded records to the Map's assets", async () => {
    const assetIds = new Set(
      (await db().orm.select({ id: mapAssets.id }).from(mapAssets)).map(
        (a) => a.id,
      ),
    );
    const linked = (await ownRows()).filter((r) => r.assetId);
    expect(linked.length).toBeGreaterThan(0);
    for (const r of linked) expect(assetIds).toContain(r.assetId);
  });

  it("settles the seeded pending rows with Sync now (nothing is queued for them)", async () => {
    expect((await seededRows()).some((r) => r.syncStatus === "pending")).toBe(
      true,
    );
    await syncPendingCaptures();
    expect((await seededRows()).every((r) => r.syncStatus === "synced")).toBe(
      true,
    );
  });

  it("gives an enumerator no review queue to decide", async () => {
    expect(await db().orm.select().from(reviewItems)).toEqual([]);
  });

  it("seeds the Settings screen's project, model update and storage", () => {
    expect(deviceStatus$.get()).toMatchObject({
      project: "Pilot Zone 3",
      model: { version: "det-v1.3.0", update: { version: "v1.4.0" } },
    });
    expect(deviceStatus$.storage.photosBytes.get()).toBeGreaterThan(0);
  });

  it("seeds the Map tab's assets", async () => {
    const assets = await db().orm.select({ id: mapAssets.id }).from(mapAssets);
    expect(assets).toHaveLength(25);
    expect(assets).toContainEqual({ id: "EP-00412" });
  });

  it("fakes a nearby duplicate and voice input for the tagging form", () => {
    expect(nearbyAssets({ latitude: 0, longitude: 0 }, [])).toEqual([
      expect.objectContaining({ id: "EP-00412" }),
    ]);
    expect(speechToText().isAvailable()).toBe(true);
  });

  it("seeds each user their own data, next to what they captured", async () => {
    const own = { ...fakeCaptures()[0], id: "own-capture", title: "My pole" };
    await seedCaptures(db(), [own]);
    await closeUserData();
    expect(peekDb()).toBeNull();

    // A supervisor captures less, under ids of their own, and gets the
    // review queue from the server rather than a seed.
    await openUserData(SUPERVISOR);
    const theirs = await seededRows();
    expect(theirs).toHaveLength(3);
    expect(theirs.every((r) => r.id.includes("supervisor"))).toBe(true);
    expect(await db().orm.select().from(reviewItems)).toEqual([]);

    // The enumerator's own capture is still theirs, and the seed isn't doubled.
    await openUserData(FIELD);
    expect(await seededRows()).toHaveLength(14);
    expect(
      (await ownRows()).find((r) => r.id === "own-capture")?.summary,
    ).toEqual(own);
  });

  it("serves supervisors review batches and each user their verdicts", async () => {
    resetReviewServer();
    const tokenOf = async (username: string) =>
      (await post("/auth/login/password", { username, password: "x" })).data
        .access_token as string;
    const as = (token: string) => ({
      headers: { Authorization: `Bearer ${token}` },
    });
    const supervisor = await tokenOf("supervisor");
    const field = await tokenOf("field");

    // Enumerators can't download the team's queue.
    await expect(
      axiosClient.get("/review/v1/batch", as(field)),
    ).rejects.toMatchObject({ response: { status: 403 } });

    const first = (await axiosClient.get("/review/v1/batch", as(supervisor)))
      .data;
    expect(first.items.map((i: { title: string }) => i.title)).toEqual([
      "Culvert · pipe",
      "Public tap",
      "Transformer",
      "Telecom pole",
    ]);
    expect(first.records).toHaveLength(4);
    const culvert = first.items[0];
    // It is the field user's own flagged capture.
    const fieldCulvert = fakeCaptures().find(
      (c) => c.title === "Culvert · pipe",
    )!;
    expect(culvert.captureId).toBe(fieldCulvert.id);
    expect(first.records[0].summary.capturedBy).toEqual({
      id: "field",
      name: "Field Enumerator",
    });

    const second = (await axiosClient.get("/review/v1/batch", as(supervisor)))
      .data;
    expect(second.items).toHaveLength(3);
    const third = (await axiosClient.get("/review/v1/batch", as(supervisor)))
      .data;
    expect(third.items).toEqual([]);

    const mine = async () =>
      (await axiosClient.get("/review/v1/mine", as(field))).data;
    expect(await mine()).toEqual([
      { captureId: fieldCulvert.id, state: "waiting" },
    ]);

    const url = `/observations/v1/stream/${culvert.captureId}/review`;
    const decision = {
      outcome: "rejected",
      rejectReason: "poor_photo",
      decidedAt: "2026-09-24T10:00:00.000Z",
    };
    await expect(
      axiosClient.patch(url, decision, as(field)),
    ).rejects.toMatchObject({ response: { status: 403 } });
    expect(
      (await axiosClient.patch(url, decision, as(supervisor))).status,
    ).toBe(200);
    await expect(
      axiosClient.patch(url, decision, as(supervisor)),
    ).rejects.toMatchObject({ response: { status: 409 } });

    // The supervisor's team: every field capture plus the other enumerators'.
    await expect(
      axiosClient.get("/records/v1/team", as(field)),
    ).rejects.toMatchObject({ response: { status: 403 } });
    const team = (await axiosClient.get("/records/v1/team", as(supervisor)))
      .data as { summary: { capturedBy: { name: string } } }[];
    expect(
      team.filter((r) => r.summary.capturedBy.name === "Field Enumerator"),
    ).toHaveLength(14);
    expect(new Set(team.map((r) => r.summary.capturedBy.name))).toEqual(
      new Set([
        "Field Enumerator",
        "Enumerator 02",
        "Enumerator 04",
        "Enumerator 07",
      ]),
    );

    expect(await mine()).toEqual([
      {
        captureId: fieldCulvert.id,
        state: "rejected",
        rejectReason: "poor_photo",
        decidedAt: "2026-09-24T10:00:00.000Z",
      },
    ]);
  }, 20_000); // Each fake response takes 400 ms.

  it("round-trips observations through the fake sync API: push, delta pull, chunked photo", async () => {
    const { outbox, observations } = require("@/db/schema");
    const { saveCapture } = require("@/services/storage/CaptureStore");
    const { drainOutbox } = require("@/services/sync/OutboxWorker");
    const {
      outboxHandlers,
      fetchChangesPage,
      uploadTransport,
    } = require("@/services/sync/SyncTransport");
    const { pullObservations } = require("@/services/sync/PullSync");
    const { observationCount } = require("../syncServer");
    const token = (
      await post("/auth/login/password", { username: "field", password: "x" })
    ).data.access_token as string;
    axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    try {
      const before = observationCount();
      await saveCapture({
        summary: { ...fakeCaptures()[0], id: "rt-1" },
        record: { id: "rt-1", poleIds: ["rt-1"] } as never,
        poles: [
          {
            pid: "rt-1",
            latitude: 0.35,
            longitude: 32.58,
            comment: "round trip",
          },
        ],
      });
      const pushed = await drainOutbox(db(), outboxHandlers);
      expect(pushed).toMatchObject({ sent: 1, failed: 0 });
      expect(observationCount()).toBe(before + 1);
      expect(await db().orm.select().from(outbox)).toEqual([]);

      // A retry after a lost response reuses the key: the server applies it once.
      const retry = (pid: string) =>
        outboxHandlers.observation.send({
          entity: "observation",
          entityId: pid,
          payload: { pid, latitude: 0.35, longitude: 32.58 },
          idempotencyKey: "replayed-key",
        });
      await retry("rt-dup");
      await retry("rt-dup-2"); // same key: ignored, even with another body
      expect(observationCount()).toBe(before + 2);

      // The delta pull brings the server's seeded observations down, a page at a time.
      const pulled = await pullObservations({
        db: db(),
        fetchPage: fetchChangesPage,
        deviceId: "dev-test",
        batchSize: 10,
      });
      expect(pulled.pages).toBeGreaterThan(1);
      const [{ n }] = await db().exec(
        "SELECT count(*) AS n FROM observations WHERE pid LIKE 'srv-%'",
      );
      expect(n).toBe(25);
      const [{ dup }] = await db().exec(
        "SELECT count(*) AS dup FROM observations WHERE pid = 'rt-dup-2'",
      );
      expect(dup).toBe(0);
      const [mine] = await db()
        .orm.select()
        .from(observations)
        .where(eq(observations.pid, "rt-1"));
      expect(mine).toMatchObject({ synced: true });

      // A photo in 64 KB chunks, resumed after a cut, then deduplicated by hash.
      const bytes = new Uint8Array(100_000).fill(7);
      const sha = require("node:crypto")
        .createHash("sha256")
        .update(bytes)
        .digest("hex");
      const session = await uploadTransport.start({
        entityId: "rt-1",
        sha256: sha,
        byteSize: bytes.length,
        fileName: "a.jpg",
      });
      expect(session).toMatchObject({ offset: 0, chunkSize: 65_536 });
      await uploadTransport.putChunk(
        session.uploadId,
        0,
        bytes.slice(0, 65_536),
        bytes.length,
      );
      // A chunk from the wrong offset is refused with the server's offset.
      await expect(
        uploadTransport.putChunk(
          session.uploadId,
          0,
          bytes.slice(0, 10),
          bytes.length,
        ),
      ).rejects.toMatchObject({
        response: { status: 409, data: { offset: 65_536 } },
      });
      expect(await uploadTransport.status(session.uploadId)).toMatchObject({
        offset: 65_536,
      });
      await uploadTransport.putChunk(
        session.uploadId,
        65_536,
        bytes.slice(65_536),
        bytes.length,
      );
      const { url } = await uploadTransport.complete(session.uploadId, sha);
      expect(url).toContain(sha);
      expect(
        await uploadTransport.start({
          entityId: "rt-2",
          sha256: sha,
          byteSize: bytes.length,
          fileName: "b.jpg",
        }),
      ).toMatchObject({ complete: true, url });
    } finally {
      delete axiosClient.defaults.headers.common.Authorization;
    }
  }, 30_000); // Each fake response takes 400 ms.

  it("reseeds the mock data on dev-reset and keeps the user's own captures", async () => {
    const own = { ...fakeCaptures()[0], id: "kept-capture", title: "Mine" };
    await seedCaptures(db(), [own]);
    // Mock rows changed or lost since the seed.
    await db().write(async (tx) => {
      await tx.delete(captures).where(eq(captures.id, "fake-capture-2"));
      await tx.delete(mapAssets);
    });

    await devMocks.reseed();

    expect(await seededRows()).toHaveLength(14);
    expect((await ownRows()).some((r) => r.id === "kept-capture")).toBe(true);
    expect(await db().orm.select({ id: mapAssets.id }).from(mapAssets)).toHaveLength(25);
  });

  it("announces itself with the marker the release check looks for", () => {
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(DEV_MOCKS_MARKER),
    );
  });

  it("signs in a listed user by username or email", async () => {
    for (const username of ["admin", "Admin@iip.example.org"]) {
      const res = await post("/auth/login/password", {
        username,
        password: "anything",
      });
      expect(res.status).toBe(200);
      const claims = jwtDecode<Claims>(res.data.access_token);
      expect(claims).toMatchObject({ sub: "admin", roles: ["admin"] });
      expect(res.data.expires_in).toBeGreaterThan(0);
    }
  });

  it("rejects unknown users, empty passwords and the 'wrong' password", async () => {
    for (const body of [
      { username: "nobody", password: "x" },
      { username: "field", password: "" },
      { username: "field", password: "wrong" },
    ]) {
      expect((await post("/auth/login/password", body)).status).toBe(401);
    }
  });

  it("registers a new account as pending", async () => {
    const res = await post("/auth/register", SIGN_UP);
    expect(res).toEqual({
      status: 201,
      data: { status: "pending_verification" },
    });
    expect(accountStore.find("Grace@UEDCL.example.org")).toMatchObject({
      name: "Grace Nakato",
      phone: "+256700123456",
      roles: [],
      status: "pending_verification",
    });
    expect(accountStore.find("grace@uedcl.example.org")).not.toHaveProperty(
      "password",
    );
  });

  it("refuses duplicate emails, including the fixture users", async () => {
    await post("/auth/register", SIGN_UP);
    for (const email of [SIGN_UP.email, "field@iip.example.org"]) {
      expect((await post("/auth/register", { ...SIGN_UP, email })).status).toBe(
        409,
      );
    }
  });

  it("rejects a registration with missing fields", async () => {
    const res = await post("/auth/register", { ...SIGN_UP, name: "" });
    expect(res.status).toBe(400);
  });

  it("keeps pending accounts out until they are approved", async () => {
    await post("/auth/register", SIGN_UP);
    const res = await post("/auth/login/password", {
      username: SIGN_UP.email,
      password: "anything",
    });
    expect(res.status).toBe(403);
    expect(res.data.code).toBe("account_pending");
  });

  it("completes the fake SSO round-trip", async () => {
    const result = await devMocks.promptSso({
      state: "s1",
      redirectUri: "mobile://redirect",
    } as never);
    expect(result).toMatchObject({
      type: "success",
      params: { code: FAKE_SSO_CODE, state: "s1" },
    });

    const res = await post("/auth/callback", { code: FAKE_SSO_CODE });
    expect(jwtDecode<Claims>(res.data.access_token).sub).toBe("field");
    expect((await post("/auth/callback", { code: "other" })).status).toBe(400);
  });

  it("refreshes its own tokens only", async () => {
    const signIn = await post("/auth/login/password", {
      username: "supervisor",
      password: "x",
    });
    const refreshed = await post("/auth/refresh", {
      token: signIn.data.access_token,
    });
    expect(jwtDecode<Claims>(refreshed.data.access_token).sub).toBe(
      "supervisor",
    );
    expect((await post("/auth/refresh", { token: "junk" })).status).toBe(401);
  });

  it("refuses to run outside a dev build", () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    g.__DEV__ = false;
    try {
      jest.isolateModules(() => {
        const fresh = require("..");
        expect(() => fresh.devMocks.install()).toThrow(/release build/);
      });
    } finally {
      g.__DEV__ = true;
    }
  });
});
