import type { CaptureSummary } from "@/types/Capture";
import { createMMKV } from "react-native-mmkv";
import { addCapture, captures$ } from "../CaptureStore";
import { opQueue$ } from "../LegendState";
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

const mockSecrets = new Map<string, string>();
jest.mock("@/services/AuthHelpers", () => ({
  getSecret: async (key: string) => mockSecrets.get(key) ?? null,
  saveSecret: async (key: string, value: string) => {
    mockSecrets.set(key, value);
  },
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `0000000${++mockUuid}-aaaa-bbbb-cccc-dddddddddddd`,
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

afterEach(() => closeUserData());

describe("user data", () => {
  it("keeps each user's records apart and saved across sign-ins", async () => {
    await openUserData(FIELD);
    expect(currentUser$.get()).toEqual(FIELD);
    addCapture(capture("field-1"));
    settings$.wifiOnlyPhotos.set(false);

    await openUserData(OTHER);
    expect(captures$.get()).toEqual([]);
    expect(settings$.wifiOnlyPhotos.get()).toBe(true);
    addCapture(capture("other-1"));

    await openUserData(FIELD);
    expect(captures$.get().map((c) => c.id)).toEqual(["field-1"]);
    expect(settings$.wifiOnlyPhotos.get()).toBe(false);
  });

  it("empties the stores on sign-out but keeps unsent work saved", async () => {
    await openUserData(FIELD);
    opQueue$.set([
      {
        opId: "op-1",
        kind: "create",
        recordLocalId: "pole-1",
        payload: { pid: "pole-1" },
        actor: "device",
        timestamp: "2026-09-24T09:00:00.000Z",
        attempts: 0,
      } as never,
    ]);
    await closeUserData();
    expect(opQueue$.get()).toEqual([]);
    expect(currentUser$.get()).toBeNull();

    await openUserData(FIELD);
    expect(opQueue$.get().map((o) => o.opId)).toEqual(["op-1"]);
  });

  it("gives the first user after an update the data kept device-wide", async () => {
    const legacy = createMMKV({ id: "obsPersist" });
    legacy.set("iip_captures_v1", JSON.stringify([capture("old-1")]));

    const first = { id: "first-after-update", name: "First" };
    await openUserData(first);
    expect(captures$.get().map((c) => c.id)).toEqual(["old-1"]);
    expect(legacy.getString("iip_captures_v1")).toBeUndefined();

    await openUserData(FIELD);
    expect(captures$.get().some((c) => c.id === "old-1")).toBe(false);
  });

  it("encrypts each user's database with their own stored key", async () => {
    await openUserData({ id: "keyed", name: "Keyed" });
    const key = mockSecrets.get("iip_user_key_keyed");
    expect(key).toHaveLength(16);
    await closeUserData();
    await openUserData({ id: "keyed", name: "Keyed" });
    expect(mockSecrets.get("iip_user_key_keyed")).toBe(key);
  });

  it("runs open hooks with the user", async () => {
    const hook = jest.fn();
    const off = onUserDataOpened(hook);
    await openUserData(FIELD);
    expect(hook).toHaveBeenCalledWith(FIELD);
    off();
  });

  it("makes a storage id from any user id", () => {
    expect(userStorageId("a.b@c.org")).toBe("iip-user-a_b_c_org");
  });
});
