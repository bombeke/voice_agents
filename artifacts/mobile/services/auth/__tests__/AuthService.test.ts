import NetInfo from "@react-native-community/netinfo";
import { AxiosError, AxiosHeaders } from "axios";
import {
  AuthError,
  passwordSignIn,
  register,
  RegisterError,
  registerErrorCode,
} from "../AuthService";

const mockPost = jest.fn();

jest.mock("@/services/Api", () => ({
  axiosClient: { post: (...args: unknown[]) => mockPost(...args) },
}));
jest.mock("@/constants/Config", () => ({ APP_SECURE_AUTH_STATE_KEY: "k" }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

const REGISTRATION = {
  name: "Grace Nakato",
  email: "grace@uedcl.example.org",
  password: "fieldwork2026",
};

function httpError(status: number, data: object = {}) {
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
      data,
    },
  );
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return (err as AuthError | RegisterError).code;
  }
  throw new Error("expected a rejection");
}

beforeEach(() => {
  jest.clearAllMocks();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
});

describe("register", () => {
  it("posts the registration and resolves on success", async () => {
    mockPost.mockResolvedValue({ status: 201, data: {} });
    await expect(register(REGISTRATION)).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith("/auth/register", REGISTRATION);
  });

  it("fails fast without a connection", async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    expect(await codeOf(register(REGISTRATION))).toBe("offline");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it.each([
    [httpError(409), "email_taken"],
    [httpError(400), "invalid"],
    [httpError(422), "invalid"],
    [httpError(500), "server_unreachable"],
    [new Error("Network Error"), "server_unreachable"],
  ])("maps %p to %p", async (error, code) => {
    mockPost.mockRejectedValue(error);
    expect(await codeOf(register(REGISTRATION))).toBe(code);
  });
});

describe("registerErrorCode", () => {
  it("falls back to server_unreachable for unknown errors", () => {
    expect(registerErrorCode(new RegisterError("email_taken"))).toBe(
      "email_taken",
    );
    expect(registerErrorCode(new Error("boom"))).toBe("server_unreachable");
  });
});

describe("passwordSignIn", () => {
  it("reports an account awaiting approval", async () => {
    mockPost.mockRejectedValue(httpError(403, { code: "account_pending" }));
    expect(await codeOf(passwordSignIn("grace", "x", true))).toBe(
      "account_pending",
    );
  });

  it("still treats other 403s as bad credentials", async () => {
    mockPost.mockRejectedValue(httpError(403));
    expect(await codeOf(passwordSignIn("grace", "x", true))).toBe(
      "invalid_credentials",
    );
  });
});
