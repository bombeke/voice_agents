import type { Session } from "@/types/Auth";
import NetInfo from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-native";
import { useSsoSignIn } from "../useSsoSignIn";

const mockDevMocks = { current: null as null | { promptSso: jest.Mock } };
const mockSignIn = jest.fn(async (_session: Session) => {});
const mockPrompt = jest.fn();
const mockPost = jest.fn();
const mockRequest = { state: "s1", codeVerifier: "v1" };

jest.mock("@/constants/Config", () => ({
  API_URL: "https://iip.example.org",
  AUTH_REDIRECT_SCHEME: "mobile",
  APP_SECURE_AUTH_STATE_KEY: "k",
}));
jest.mock("@/mocks", () => ({
  get devMocks() {
    return mockDevMocks.current;
  },
}));
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));
jest.mock("@/services/Api", () => ({
  axiosClient: { post: (...args: unknown[]) => mockPost(...args) },
}));
jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "mobile://redirect",
  ResponseType: { Code: "code" },
  useAuthRequest: () => [mockRequest, null, mockPrompt],
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

const NOW = 1_700_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockDevMocks.current = null;
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(NOW * 1000);
});
afterEach(() => jest.useRealTimers());

/** Unsigned JWT for `sub`, enough for jwtDecode. */
function fakeToken(sub: string) {
  return `e30.${btoa(JSON.stringify({ sub, exp: NOW + 60 }))}.`;
}

async function start(persist = true) {
  const hook = await renderHook(() => useSsoSignIn());
  await act(() => hook.result.current.start(persist));
  return hook.result;
}

describe("useSsoSignIn", () => {
  it("uses the dev fake instead of the browser when API mocking is on", async () => {
    mockDevMocks.current = {
      promptSso: jest.fn(async () => ({
        type: "success",
        params: { code: "dev-sso-code", state: "s1" },
      })),
    };
    mockPost.mockResolvedValue({
      data: { access_token: fakeToken("dev"), expires_in: 60 },
    });
    await start(false);

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(mockDevMocks.current.promptSso).toHaveBeenCalledWith(mockRequest);
    expect(mockSignIn.mock.calls[0][0]).toMatchObject({
      method: "sso",
      persist: false,
    });
  });

  it("exchanges the code with its PKCE verifier and stores an absolute expiry", async () => {
    const token = fakeToken("casdoor-user");
    mockPrompt.mockResolvedValue({
      type: "success",
      params: { code: "c1", state: "s1" },
    });
    mockPost.mockResolvedValue({
      data: { access_token: token, expires_in: 3600 },
    });

    const result = await start();

    expect(mockPost).toHaveBeenCalledWith("/auth/callback", {
      code: "c1",
      state: "s1",
      code_verifier: "v1",
      redirect_uri: "mobile://redirect",
    });
    expect(mockSignIn.mock.calls[0][0]).toMatchObject({
      token,
      expiresAt: NOW + 3600,
      method: "sso",
      persist: true,
      claims: { sub: "casdoor-user" },
    });
    expect(result.current.error).toBeNull();
  });

  it("does nothing when the user cancels", async () => {
    mockPrompt.mockResolvedValue({ type: "cancel" });
    const result = await start();

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("rejects a response whose state does not match", async () => {
    mockPrompt.mockResolvedValue({
      type: "success",
      params: { code: "c1", state: "forged" },
    });
    const result = await start();

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.current.error).toBe("sso_failed");
  });

  it("needs a connection", async () => {
    jest
      .mocked(NetInfo.fetch)
      .mockResolvedValueOnce({ isConnected: false } as never);
    const result = await start();

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(result.current.error).toBe("offline");
  });

  it("reports an unreachable server", async () => {
    mockPrompt.mockResolvedValue({
      type: "success",
      params: { code: "c1", state: "s1" },
    });
    mockPost.mockRejectedValue(new Error("Network Error"));
    const result = await start();

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(result.current.error).toBe("server_unreachable");
  });
});
