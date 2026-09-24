import { strings } from "@/constants/Strings";
import type { Claims } from "@/types/Auth";
import type { StorageUsage } from "@/types/Settings";
import { fill, formatClock, isSameLocalDay } from "@/helpers/format";
import { formatDate } from "@/helpers/mapAssets";

const MB = 1_000_000;
const GB = 1_000_000_000;
const s = strings.settings;

/** 312_000_000 → "312 MB", 1_400_000_000 → "1.4 GB" (decimal units, as phones show). */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    return fill(s.storage.gigabytes, { value: (bytes / GB).toFixed(1) });
  }
  return fill(s.storage.megabytes, { value: Math.round(bytes / MB) });
}

export type StorageKind = "photos" | "map" | "model";

export interface StorageBreakdown {
  totalBytes: number;
  /** Each kind's share of the total (0–1), for the stacked bar. */
  segments: { kind: StorageKind; bytes: number; share: number }[];
}

/** The stacked bar's segments; records and caches fill the rest of the track. */
export function storageBreakdown(usage: StorageUsage): StorageBreakdown {
  const totalBytes =
    usage.photosBytes + usage.mapBytes + usage.modelBytes + usage.otherBytes;
  const segment = (kind: StorageKind, bytes: number) => ({
    kind,
    bytes,
    share: totalBytes > 0 ? bytes / totalBytes : 0,
  });
  return {
    totalBytes,
    segments: [
      segment("photos", usage.photosBytes),
      segment("map", usage.mapBytes),
      segment("model", usage.modelBytes),
    ],
  };
}

/** "Today 09:02", "Yesterday 17:40", "12 Aug 2026", or "Never". */
export function formatLastSynced(
  iso: string | undefined,
  now: Date = new Date(),
): string {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return s.sync.never;
  const time = formatClock(at);
  if (isSameLocalDay(at, now)) return fill(s.sync.today, { time });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(at, yesterday)) return fill(s.sync.yesterday, { time });
  return formatDate(at.getTime());
}

/** The name on the account card: full name, then username, then subject. */
export function displayName(claims?: Claims | null): string {
  return (
    claims?.name ||
    claims?.preferred_username ||
    claims?.sub ||
    s.account.fallbackName
  );
}

/** Highest role the account holds, as the account card shows it. */
export function roleLabel(claims?: Claims | null): string {
  const roles = claims?.roles ?? [];
  const { admin, supervisor, enumerator } = s.account.roles;
  if (roles.includes("admin")) return admin;
  if (roles.includes("supervisor")) return supervisor;
  return enumerator;
}

/** "https://iip.example.org/api" → "iip.example.org"; unparseable input as-is. */
export function hostOf(url: string): string {
  const match = /^[a-z][a-z\d+.-]*:\/\/([^/:?#]+)/i.exec(url.trim());
  return match ? match[1] : url;
}

/** "1.0.0 (100)"; the build number is left out when unknown. */
export function formatAppVersion(
  version?: string | null,
  build?: string | null,
): string {
  const v = version || "0.0.0";
  return build ? `${v} (${build})` : v;
}
