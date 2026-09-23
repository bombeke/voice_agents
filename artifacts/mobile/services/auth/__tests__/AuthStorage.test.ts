import type { Session } from "@/types/Auth";

// One "disk" shared by MMKV and SecureStore, so it survives the module reloads
// that `relaunch()` uses to simulate restarting the app.
const mockDisk = new Map<string, string>();
const mockSecure = {
  set: jest.fn(async (k: string, v: string) => {
    mockDisk.set(`secure:${k}`, v);
  }),
  get: jest.fn(async (k: string) => mockDisk.get(`secure:${k}`) ?? null),
  remove: jest.fn(async (k: string) => {
    mockDisk.delete(`secure:${k}`);
  }),
};

jest.mock("@/constants/Config", () => ({
  APP_SECURE_AUTH_STATE_KEY: "token-key",
}));
jest.mock("expo-secure-store", () => ({
  setItemAsync: (k: string, v: string) => mockSecure.set(k, v),
  getItemAsync: (k: string) => mockSecure.get(k),
  deleteItemAsync: (k: string) => mockSecure.remove(k),
}));
jest.mock("react-native-mmkv", () => ({
  createMMKV: () => ({
    set: (k: string, v: string) => mockDisk.set(`mmkv:${k}`, v),
    getString: (k: string) => mockDisk.get(`mmkv:${k}`),
    remove: (k: string) => mockDisk.delete(`mmkv:${k}`),
  }),
}));

const session = (persist: boolean): Session => ({
  token: "jwt",
  expiresAt: 2_000_000_000,
  claims: { sub: "field", exp: 2_000_000_000 },
  method: "password",
  persist,
});

/** A fresh module instance: the in-memory session is gone, the disk is not. */
function relaunch(): typeof import("../AuthStorage") {
  let mod!: typeof import("../AuthStorage");
  jest.isolateModules(() => {
    mod = require("../AuthStorage");
  });
  return mod;
}

beforeEach(() => {
  mockDisk.clear();
  jest.clearAllMocks();
});

describe("AuthStorage", () => {
  it("keeps a persisted session across relaunches, token in SecureStore", async () => {
    await relaunch().saveSession(session(true));
    expect(mockSecure.set).toHaveBeenCalledWith("token-key", "jwt");
    expect(await relaunch().loadSession()).toEqual(session(true));
  });

  it("keeps a non-persisted session in memory only", async () => {
    const storage = relaunch();
    await storage.saveSession(session(false));
    expect(await storage.getToken()).toBe("jwt");
    expect(mockSecure.set).not.toHaveBeenCalled();
    expect(await relaunch().loadSession()).toBeNull();
  });

  it("removes the stored token on sign-out", async () => {
    const storage = relaunch();
    await storage.saveSession(session(true));
    await storage.clearSession();
    expect(mockSecure.remove).toHaveBeenCalledWith("token-key");
    expect(await storage.loadSession()).toBeNull();
    expect(await relaunch().getToken()).toBeNull();
  });
});
