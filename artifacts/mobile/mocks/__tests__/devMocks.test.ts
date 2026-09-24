import type { Claims } from "@/types/Auth";
import { jwtDecode } from "jwt-decode";
import { DEV_MOCKS_MARKER, devMocks, FAKE_SSO_CODE } from "..";
import { nearbyAssets } from "@/services/capture/NearbyAssets";
import { speechToText } from "@/services/capture/SpeechToText";
import { mapAssets$ } from "@/services/storage/AssetStore";
import { captures$, gnssStatus$ } from "@/services/storage/CaptureStore";
import { reviewQueue$ } from "@/services/storage/ReviewStore";
import { deviceStatus$ } from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { accountStore } from "../AccountStore";
import { fakeCaptures } from "../captures";
import { devMocks as stub } from "../stub";

jest.mock("@/services/Api", () => ({
  axiosClient: require("axios").create({ baseURL: "https://api.test" }),
  // The op queue behind "Sync now" builds a query on import.
  queryClient: new (require("@tanstack/react-query").QueryClient)(),
}));

const { axiosClient } = jest.requireMock("@/services/Api");

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  devMocks.install();
});
beforeEach(() => accountStore.clear());

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

  it("seeds the Home screen's captures and GNSS state", () => {
    expect(captures$.get()).toHaveLength(14);
    expect(gnssStatus$.get()).toEqual({ bands: "L1+L5", ok: true });
  });

  it("links seeded records to the Map's assets", () => {
    const assetIds = new Set(mapAssets$.get().map((a) => a.id));
    const linked = captures$.get().filter((c) => c.assetId);
    expect(linked.length).toBeGreaterThan(0);
    for (const c of linked) expect(assetIds).toContain(c.assetId);
  });

  it("fakes the uploader behind Sync now", async () => {
    jest.useFakeTimers();
    try {
      captures$.set(fakeCaptures());
      const done = syncPendingCaptures();
      await jest.runAllTimersAsync();
      await done;
      expect(captures$.get().every((c) => c.syncStatus === "synced")).toBe(
        true,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("seeds the supervisor's queue, linked to the fake captures", () => {
    const queue = reviewQueue$.get();
    expect(queue).toHaveLength(4);
    const captureIds = new Set(captures$.get().map((c) => c.id));
    const linked = queue.filter((i) => i.captureId);
    expect(linked.length).toBeGreaterThan(0);
    for (const i of linked) expect(captureIds).toContain(i.captureId);
  });

  it("seeds the Settings screen's project, model update and storage", () => {
    expect(deviceStatus$.get()).toMatchObject({
      project: "Pilot Zone 3",
      model: { version: "det-v1.3.0", update: { version: "v1.4.0" } },
    });
    expect(deviceStatus$.storage.photosBytes.get()).toBeGreaterThan(0);
  });

  it("seeds the Map tab's assets", () => {
    expect(mapAssets$.get()).toHaveLength(25);
    expect(mapAssets$.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "EP-00412" })]),
    );
  });

  it("fakes a nearby duplicate and voice input for the tagging form", () => {
    expect(nearbyAssets({ latitude: 0, longitude: 0 }, [])).toEqual([
      expect.objectContaining({ id: "EP-00412" }),
    ]);
    expect(speechToText().isAvailable()).toBe(true);
  });

  it("adds the seed next to real captures and keeps decided reviews out", () => {
    // A fresh install, with its own stores, on a device that has data.
    jest.isolateModules(() => {
      const { captures$ } = require("@/services/storage/CaptureStore");
      const { records$ } = require("@/services/storage/RecordStore");
      const {
        reviewQueue$,
        reviewDecisions$,
      } = require("@/services/storage/ReviewStore");
      const own = { ...fakeCaptures()[0], id: "own-capture", title: "My pole" };
      captures$.set([own]);
      reviewDecisions$.set({
        "fake-review-1": {
          itemId: "fake-review-1",
          outcome: "approved",
          decidedAt: new Date().toISOString(),
          syncStatus: "pending",
        },
      });
      require("..").devMocks.install();

      const captures = captures$.get();
      expect(captures[0]).toBe(own);
      expect(captures).toHaveLength(15);
      expect(records$.get()["fake-capture-1"]).toBeDefined();
      expect(records$.get()["own-capture"]).toBeUndefined();
      expect(reviewQueue$.get().map((i: { id: string }) => i.id)).toEqual([
        "fake-review-2",
        "fake-review-3",
        "fake-review-4",
      ]);
    });
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
