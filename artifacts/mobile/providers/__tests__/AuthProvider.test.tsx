import NetInfo from "@react-native-community/netinfo";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";
import type { Session } from "@/types/Auth";
import { AuthProvider, useAuth } from "../AuthProvider";

const mockStorage = {
  loadSession: jest.fn(),
  saveSession: jest.fn(async (_session: Session) => {}),
  clearSession: jest.fn(async () => {}),
};
const mockRefresh = jest.fn();

jest.mock("@/services/auth/AuthStorage", () => ({
  loadSession: () => mockStorage.loadSession(),
  saveSession: (s: Session) => mockStorage.saveSession(s),
  clearSession: () => mockStorage.clearSession(),
}));
const mockUserData = {
  openUserData: jest.fn(async (_user: { id: string; name: string }) => {}),
  closeUserData: jest.fn(async () => {}),
};
jest.mock("@/services/storage/UserData", () => ({
  openUserData: (user: { id: string; name: string }) =>
    mockUserData.openUserData(user),
  closeUserData: () => mockUserData.closeUserData(),
}));
jest.mock("@/services/auth/AuthService", () => ({
  refreshSession: () => mockRefresh(),
}));
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

const NOW = 1_700_000_000;
const session = (expiresAt: number, roles: string[] = []): Session => ({
  token: "jwt",
  expiresAt,
  claims: { sub: "field", exp: expiresAt, roles, org: "Pilot Zone 3" },
  method: "password",
  persist: true,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

async function boot() {
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(NOW * 1000);
});
afterEach(() => jest.useRealTimers());

describe("AuthProvider", () => {
  it("starts signed out without a stored session", async () => {
    mockStorage.loadSession.mockResolvedValue(null);
    const auth = await boot();
    expect(auth.current.isAuthenticated).toBe(false);
  });

  it("restores a valid session with its claims", async () => {
    mockStorage.loadSession.mockResolvedValue(session(NOW + 3600, ["admin"]));
    const auth = await boot();

    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.claims?.sub).toBe("field");
    expect(auth.current.org).toBe("Pilot Zone 3");
    expect(auth.current.authMethod).toBe("password");
    expect(auth.current.adminMode).toBe("online");
    expect(mockUserData.openUserData).toHaveBeenCalledWith({
      id: "field",
      name: "field",
    });
  });

  it("gives the roles' permissions on top of the token's", async () => {
    mockStorage.loadSession.mockResolvedValue(
      session(NOW + 3600, ["supervisor"]),
    );
    const auth = await boot();
    expect(auth.current.permissions).toEqual(
      expect.arrayContaining(["records:read:own", "records:review"]),
    );
  });

  it("stays signed out when the user's data cannot open", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockStorage.loadSession.mockResolvedValue(session(NOW + 3600));
    mockUserData.openUserData.mockRejectedValueOnce(new Error("keystore"));
    const auth = await boot();
    expect(auth.current.isAuthenticated).toBe(false);
  });

  it("keeps an expired session offline, with its cached claims", async () => {
    mockStorage.loadSession.mockResolvedValue(session(NOW - 60, ["admin"]));
    jest
      .mocked(NetInfo.fetch)
      .mockResolvedValueOnce({ isConnected: false } as never);
    const auth = await boot();

    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.claims).not.toBeNull();
    expect(auth.current.offlineMode).toBe(true);
    expect(auth.current.adminMode).toBe("offline-readonly");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("signs out an expired session that cannot be refreshed online", async () => {
    mockStorage.loadSession.mockResolvedValue(session(NOW - 60));
    mockRefresh.mockResolvedValue(false);
    const auth = await boot();

    expect(auth.current.isAuthenticated).toBe(false);
    expect(mockStorage.clearSession).toHaveBeenCalled();
  });

  it("signs in and out", async () => {
    mockStorage.loadSession.mockResolvedValue(null);
    const auth = await boot();
    const next = session(NOW + 3600);

    await act(() => auth.current.signIn({ ...next, method: "sso" }));
    expect(mockStorage.saveSession).toHaveBeenCalledWith({
      ...next,
      method: "sso",
    });
    expect(auth.current.isAuthenticated).toBe(true);
    expect(auth.current.authMethod).toBe("sso");
    expect(mockUserData.openUserData).toHaveBeenCalledWith({
      id: "field",
      name: "field",
    });

    await act(() => auth.current.logout());
    expect(mockStorage.clearSession).toHaveBeenCalled();
    expect(mockUserData.closeUserData).toHaveBeenCalled();
    expect(auth.current.isAuthenticated).toBe(false);
    expect(auth.current.authMethod).toBeUndefined();
  });
});
