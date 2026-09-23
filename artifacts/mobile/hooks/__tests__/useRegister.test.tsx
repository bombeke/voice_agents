import { RegisterError } from "@/services/auth/AuthService";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ReactNode } from "react";
import { useRegister } from "../useRegister";

const mockRegister = jest.fn();

jest.mock("@/services/Api", () => ({ axiosClient: { post: jest.fn() } }));
jest.mock("@/constants/Config", () => ({ APP_SECURE_AUTH_STATE_KEY: "k" }));
jest.mock("expo-secure-store", () => ({}));
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);
jest.mock("@/services/auth/AuthService", () => ({
  ...jest.requireActual("@/services/auth/AuthService"),
  register: (...args: unknown[]) => mockRegister(...args),
}));

const REGISTRATION = {
  name: "Grace Nakato",
  email: "grace@uedcl.example.org",
  password: "fieldwork2026",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    // No GC timer: it would keep Jest alive after the run.
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function submit() {
  const { result } = await renderHook(() => useRegister(), { wrapper });
  await act(async () => result.current.submit(REGISTRATION));
  return result;
}

beforeEach(() => jest.clearAllMocks());

describe("useRegister", () => {
  it("is done once the backend accepts the registration", async () => {
    mockRegister.mockResolvedValue(undefined);
    const result = await submit();

    await waitFor(() => expect(result.current.done).toBe(true));
    expect(mockRegister).toHaveBeenCalledWith(REGISTRATION);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("exposes the register error code", async () => {
    mockRegister.mockRejectedValue(new RegisterError("email_taken"));
    const result = await submit();

    await waitFor(() => expect(result.current.error).toBe("email_taken"));
    expect(result.current.done).toBe(false);
  });

  it("clears the error on reset", async () => {
    mockRegister.mockRejectedValue(new Error("boom"));
    const result = await submit();
    await waitFor(() =>
      expect(result.current.error).toBe("server_unreachable"),
    );

    await act(async () => result.current.reset());
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
