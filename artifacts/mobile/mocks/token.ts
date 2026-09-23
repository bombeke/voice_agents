import type { Claims } from "@/types/Auth";
import type { FakeUser } from "./fixtures";
import { FAKE_ORG } from "./fixtures";

/** Fake sessions last a working day. */
export const FAKE_TOKEN_TTL = 12 * 60 * 60;

export function fakeClaims(
  user: FakeUser,
  ttlSeconds = FAKE_TOKEN_TTL,
): Claims {
  return {
    sub: user.username,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    name: user.name,
    email: user.email,
    preferred_username: user.username,
    roles: user.roles,
    permissions: user.permissions,
    org: FAKE_ORG,
  };
}

/** Unsigned JWT: decodes like a real one, and any real server rejects it. */
export function fakeToken(claims: Claims): string {
  return `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url(claims)}.`;
}

function base64Url(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
