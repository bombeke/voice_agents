import { peekDb, setDatabaseFactory } from "@/db/Current";
import { captures, outbox } from "@/db/schema";
import { openNodeDatabase } from "@/db/testing/NodeDatabase";
import type { CaptureSummary } from "@/types/Capture";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMMKV } from "react-native-mmkv";
import { captureRow, upsertOwnCaptures } from "../repos/CaptureRepo";
import { settings$ } from "../SettingsStore";
import {
  closeUserData,
  currentUser$,
  onUserDataOpened,
  openUserData,
  userStorageId,
} from "../UserData";

jest.mock("@/services/Api", () => ({
  axiosClient: { get: jest.fn(), post: jest.fn() },
  queryClient: new (require("@tanstack/react-query").QueryClient)(),
}));
jest.mock("@/services/sync/SyncRuntime", () => ({
  startSync: jest.fn(),
  stopSync: jest.fn(async () => undefined),
}));

const mockSecrets = new Map<string, string>();
jest.mock("@/services/AuthHelpers", () => ({
  getSecret: async (key: string) => mockSecrets.get(key) ?? null,
  saveSecret: async (key: string, value: string) => {
    mockSecrets.set(key, value);
  },
}));

const FIELD = { id: "field", name: "Field Enumerator" };
const OTHER = { id: "other@iip.example.org", name: "Other Enumerator" };

const capture = (id: string): CaptureSummary => ({
  id,
  category: "energy",
  title: "Concrete pole",
  capturedAt: "2026-09-24T09:00:00.000Z",
  accuracyM: 2.8,
  syncStatus: "pending",
  flagged: false,
});

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "userdata-"));
  // Each user's database is its own file, kept across sign-ins.
  setDatabaseFactory((userId) =>
    openNodeDatabase(join(dir, `${userStorageId(userId)}.db`), {
      migrated: false,
    }),
  );
});
afterAll(() => {
  setDatabaseFactory(null);
  rmSync(dir, { recursive: true, force: true });
});
afterEach(() => closeUserData());

const ownIds = async () =>
  (await peekDb()!.orm.select({ id: captures.id }).from(captures)).map(
    (r) => r.id,
  );

const addCapture = (c: CaptureSummary) =>
  peekDb()!.write((tx) =>
    upsertOwnCaptures(tx, [captureRow(c, null, "mine", 0)]),
  );

describe("user data", () => {
  it("keeps each user's records apart and saved across sign-ins", async () => {
    await openUserData(FIELD);
    expect(currentUser$.get()).toEqual(FIELD);
    await addCapture(capture("field-1"));
    settings$.wifiOnlyPhotos.set(false);

    await openUserData(OTHER);
    expect(await ownIds()).toEqual([]);
    expect(settings$.wifiOnlyPhotos.get()).toBe(true);
    await addCapture(capture("other-1"));

    await openUserData(FIELD);
    expect(await ownIds()).toEqual(["field-1"]);
    expect(settings$.wifiOnlyPhotos.get()).toBe(false);
  });

  it("closes the database on sign-out but keeps unsent work saved", async () => {
    await openUserData(FIELD);
    await addCapture(capture("unsent"));
    await closeUserData();
    expect(peekDb()).toBeNull();
    expect(currentUser$.get()).toBeNull();

    await openUserData(FIELD);
    expect(await ownIds()).toContain("unsent");
  });

  it("imports the blobs of a build before SQLite once, into the first user's database", async () => {
    const legacy = createMMKV({ id: "obsPersist" });
    legacy.set("iip_captures_v1", JSON.stringify([capture("old-1")]));
    legacy.set(
      "polevision_events_opqueue_v1",
      JSON.stringify([
        {
          opId: "op-1",
          kind: "create",
          recordLocalId: "old-1",
          payload: { pid: "old-1", vc: { d: 1 } },
          idempotencyKey: "k1",
        },
      ]),
    );

    const first = { id: "first-after-update", name: "First" };
    await openUserData(first);
    expect(await ownIds()).toEqual(["old-1"]);
    expect(
      await peekDb()!.orm.select({ key: outbox.idempotencyKey }).from(outbox),
    ).toEqual([{ key: "k1" }]);
    expect(legacy.getString("iip_captures_v1")).toBeUndefined();
    // Moved out of MMKV into SQLite: the user's MMKV doesn't keep the blob either.
    expect(
      createMMKV({ id: userStorageId(first.id) }).getString("iip_captures_v1"),
    ).toBeUndefined();

    await openUserData(FIELD);
    expect(await ownIds()).not.toContain("old-1");
  });

  it("encrypts each user's preferences with their own stored key", async () => {
    await openUserData({ id: "keyed", name: "Keyed" });
    const key = mockSecrets.get("iip_user_key_keyed");
    expect(key).toHaveLength(16);
    await closeUserData();
    await openUserData({ id: "keyed", name: "Keyed" });
    expect(mockSecrets.get("iip_user_key_keyed")).toBe(key);
  });

  it("runs open hooks with the user, then starts the sync workers", async () => {
    const { startSync } = jest.requireMock("@/services/sync/SyncRuntime");
    const hook = jest.fn();
    const off = onUserDataOpened(hook);
    await openUserData(FIELD);
    expect(hook).toHaveBeenCalledWith(FIELD);
    expect(startSync).toHaveBeenCalledWith(peekDb());
    off();
  });

  it("makes a storage id from any user id", () => {
    expect(userStorageId("a.b@c.org")).toBe("iip-user-a_b_c_org");
  });
});
