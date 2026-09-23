import type { AuthRequest, AuthSessionResult } from "expo-auth-session";

/** Dev-only fake backend. Release builds get `null` (see mocks/stub.ts). */
export interface DevMocks {
  /** Answer API requests from the in-app fake server. */
  install(): void;
  /** Stands in for the Casdoor browser step of "Continue with SSO". */
  promptSso(request: AuthRequest): Promise<AuthSessionResult>;
}
