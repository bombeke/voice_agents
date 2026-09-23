import type { Session } from "@/types/Auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AxiosError, AxiosHeaders } from "axios";
import { ReactNode } from "react";
import { usePasswordSignIn } from "../usePasswordSignIn";

const mockSignIn = jest.fn(async (_session: Session) => {});
const mockPost = jest.fn();

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));
jest.mock("@/constants/Config", () => ({ APP_SECURE_AUTH_STATE_KEY: "k" }));
jest.mock("@/services/Api", () => ({
  axiosClient: { post: (...args: unknown[]) => mockPost(...args) },
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
// An unsigned JWT carrying { sub: "field", exp }.
const TOKEN = `e30.${btoa(JSON.stringify({ sub: "field", exp: NOW + 60 }))}.`;

function httpError(status: number) {
  const headers = new AxiosHeaders();
  return new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    { headers },
    null,
    {
      status,
      statusText: "",
      headers: {},
      config: { headers },
      data: {},
    },
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function submit(persist = true) {
  const { result } = await renderHook(() => usePasswordSignIn(), { wrapper });
  await act(async () =>
    result.current.submit({
      identifier: " field@iip.example.org ",
      password: "secret",
      persist,
    }),
  );
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(NOW * 1000);
});
afterEach(() => jest.useRealTimers());

describe("usePasswordSignIn", () => {
  it("signs in with the backend's token and the chosen persistence", async () => {
    mockPost.mockResolvedValue({
      data: { access_token: TOKEN, expires_in: 3600 },
    });
    const result = await submit(false);

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("/auth/login/password", {
      username: "field@iip.example.org",
      password: "secret",
    });
    expect(mockSignIn.mock.calls[0][0]).toMatchObject({
      token: TOKEN,
      expiresAt: NOW + 3600,
      method: "password",
      persist: false,
      claims: { sub: "field" },
    });
    expect(result.current.error).toBeNull();
  });

  it("reports rejected credentials without signing in", async () => {
    mockPost.mockRejectedValue(httpError(401));
    const result = await submit();

    await waitFor(() =>
      expect(result.current.error).toBe("invalid_credentials"),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("reports an unreachable server", async () => {
    mockPost.mockRejectedValue(new Error("Network Error"));
    const result = await submit();

    await waitFor(() =>
      expect(result.current.error).toBe("server_unreachable"),
    );
  });
});
