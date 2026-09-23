import type { Registration } from "@/helpers/registration";
import type { AuthMethod, Claims, Session } from "@/types/Auth";
import NetInfo from "@react-native-community/netinfo";
import { isAxiosError } from "axios";
import type { AuthSessionResult } from "expo-auth-session";
import { jwtDecode } from "jwt-decode";
import { axiosClient } from "../Api";
import { clearSession, loadSession, saveSession } from "./AuthStorage";

export type AuthErrorCode =
  | "invalid_credentials"
  | "account_pending"
  | "offline"
  | "sso_failed"
  | "server_unreachable";

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

type TokenResponse = {
  token?: string;
  access_token?: string;
  expires_in?: number;
  claims?: Claims;
};

/** The code of an `AuthError`, or `fallback` for anything else. */
export function authErrorCode(err: unknown, fallback: AuthErrorCode) {
  return err instanceof AuthError ? err.code : fallback;
}

export type RegisterErrorCode =
  "offline" | "email_taken" | "invalid" | "server_unreachable";

export class RegisterError extends Error {
  constructor(readonly code: RegisterErrorCode) {
    super(code);
    this.name = "RegisterError";
  }
}

export function registerErrorCode(err: unknown): RegisterErrorCode {
  return err instanceof RegisterError ? err.code : "server_unreachable";
}

/** Turn a backend token response into a session with an absolute expiry. */
function toSession(
  data: TokenResponse | undefined,
  method: AuthMethod,
  persist: boolean,
): Session | null {
  const token = data?.token ?? data?.access_token;
  if (!token) return null;

  let claims = data?.claims ?? null;
  try {
    claims = jwtDecode<Claims>(token);
  } catch {
    // Opaque token: rely on the claims the backend sent alongside it.
  }
  if (!claims) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = data?.expires_in ? now + data.expires_in : claims.exp;
  if (!expiresAt) return null;

  return { token, expiresAt, claims, method, persist };
}

export async function exchangeSsoCode(params: {
  code: string;
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  persist: boolean;
}): Promise<Session> {
  const { persist, ...body } = params;
  let data: TokenResponse | undefined;
  try {
    const res = await axiosClient.post<TokenResponse>("/auth/callback", {
      code: body.code,
      state: body.state,
      code_verifier: body.codeVerifier,
      redirect_uri: body.redirectUri,
    });
    data = res.data;
  } catch {
    throw new AuthError("server_unreachable");
  }
  const session = toSession(data, "sso", persist);
  if (!session) throw new AuthError("sso_failed");
  return session;
}

/**
 * Username/password sign-in. The backend checks the credentials with Casdoor
 * server-side and answers like `/auth/callback`; the app never sees a secret.
 */
export async function passwordSignIn(
  identifier: string,
  password: string,
  persist: boolean,
): Promise<Session> {
  let data: TokenResponse | undefined;
  try {
    const res = await axiosClient.post<TokenResponse>("/auth/login/password", {
      username: identifier.trim(),
      password,
    });
    data = res.data;
  } catch (err) {
    const res = isAxiosError(err) ? err.response : undefined;
    if (res?.status === 403 && res.data?.code === "account_pending") {
      throw new AuthError("account_pending");
    }
    throw new AuthError(
      res?.status === 400 || res?.status === 401 || res?.status === 403
        ? "invalid_credentials"
        : "server_unreachable",
    );
  }
  const session = toSession(data, "password", persist);
  if (!session) throw new AuthError("server_unreachable");
  return session;
}

/**
 * Self-service sign-up. The account starts pending: the user confirms their
 * email, then an administrator approves the role and project area, so this
 * never returns a session. Needs a connection; the password is never queued.
 */
export async function register(registration: Registration): Promise<void> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) throw new RegisterError("offline");

  try {
    await axiosClient.post("/auth/register", registration);
  } catch (err) {
    const status = isAxiosError(err) ? err.response?.status : undefined;
    throw new RegisterError(
      status === 409
        ? "email_taken"
        : status === 400 || status === 422
          ? "invalid"
          : "server_unreachable",
    );
  }
}

/**
 * Refresh the stored session if it expires within two minutes.
 * Returns true if a usable session is stored afterwards.
 */
export async function refreshSession(): Promise<boolean> {
  const session = await loadSession();
  if (!session) return false;

  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt > now + 120) return true;

  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return false;

  try {
    const res = await axiosClient.post<TokenResponse>("/auth/refresh", {
      token: session.token,
    });
    const next = toSession(res.data, session.method, session.persist);
    if (!next) {
      await clearSession();
      return false;
    }
    await saveSession(next);
    return true;
  } catch (err) {
    console.error("Failed to refresh session:", err);
    await clearSession();
    return false;
  }
}

export function validateCasdoorAuthResponse(
  response: AuthSessionResult | null,
  expectedState?: string,
): asserts response is AuthSessionResult & {
  type: "success";
  params: { code: string; state: string };
} {
  if (!response || response.type !== "success") {
    throw new Error("Authentication failed or was cancelled");
  }

  const { code, state } = response.params ?? {};

  if (!code) {
    throw new Error("Missing authorization code");
  }

  if (!state) {
    throw new Error("Missing OAuth state");
  }

  if (expectedState && state !== expectedState) {
    throw new Error("Invalid OAuth state (possible CSRF)");
  }
}
