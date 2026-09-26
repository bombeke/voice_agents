import type { AuthRequest, AuthSessionResult } from "expo-auth-session";
import type { ComponentType } from "react";

/** Dev-only fake backend. Release builds get `null` (see mocks/stub.ts). */
export interface DevMocks {
  /** Answer API requests from the in-app fake server. */
  install(): void;
  /** Stands in for the Casdoor browser step of "Continue with SSO". */
  promptSso(request: AuthRequest): Promise<AuthSessionResult>;
  /** The on-device storage benchmark (`mobile://dev-bench?n=50000`). */
  BenchView: ComponentType;
  /**
   * `mobile://dev-reset`: replaces the signed-in user's seeded mock data with
   * a fresh seed and resets the fake server. Real captures are kept.
   */
  reseed(): Promise<void>;
}
