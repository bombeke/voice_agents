import { IClaims } from "@/providers/AuthProvider";

export function isTokenExpired(expiresAt?: number | null) {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 30; // 30s grace window
}

export function hasPerm(claims: IClaims | null, perm: string): boolean {
  return claims?.permissions?.includes(perm)?? false;
}
