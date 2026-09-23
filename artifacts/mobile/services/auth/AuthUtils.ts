import type { Claims } from "@/types/Auth";

export function isTokenExpired(expiresAt?: number | null) {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 30; // 30s grace window
}

export function hasPerm(claims: Claims | null, perm: string): boolean {
  return claims?.permissions?.includes(perm) ?? false;
}
