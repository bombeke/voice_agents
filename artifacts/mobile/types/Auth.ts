/** JWT claims the app reads. Backend and mock tokens both carry these. */
export interface Claims {
  sub: string;
  exp: number;
  name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  permissions?: string[];
  org?: string;
}

export type AuthMethod = "sso" | "password";

export interface Session {
  token: string;
  /** Absolute expiry in epoch seconds. */
  expiresAt: number;
  claims: Claims;
  method: AuthMethod;
  /** "Keep me signed in on this device": false keeps the session in memory only. */
  persist: boolean;
}
