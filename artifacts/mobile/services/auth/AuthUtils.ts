import type { Claims } from "@/types/Auth";
import { effectivePermissions } from "./Roles";

export function isTokenExpired(expiresAt?: number | null) {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 30; // 30s grace window
}

/** Granted by the token or implied by one of its roles (see Roles.ts). */
export function hasPerm(claims: Claims | null, perm: string): boolean {
  return effectivePermissions(claims).includes(perm);
}
