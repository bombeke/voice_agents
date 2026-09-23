import { strings } from "@/constants/Strings";
import type { CaptureSummary, CaptureSyncStatus } from "@/types/Capture";

export interface TodayStats {
  capturedToday: number;
  synced: number;
  flagged: number;
  /** Every unsynced record on the device, not only today's. */
  pending: number;
}

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function summariseToday(
  captures: readonly CaptureSummary[],
  now: Date = new Date(),
): TodayStats {
  const stats: TodayStats = {
    capturedToday: 0,
    synced: 0,
    flagged: 0,
    pending: 0,
  };
  for (const c of captures) {
    if (c.syncStatus !== "synced") stats.pending++;
    if (!isSameLocalDay(new Date(c.capturedAt), now)) continue;
    stats.capturedToday++;
    if (c.syncStatus === "synced") stats.synced++;
    if (c.flagged) stats.flagged++;
  }
  return stats;
}

export function latestCapture(
  captures: readonly CaptureSummary[],
): CaptureSummary | undefined {
  let latest: CaptureSummary | undefined;
  for (const c of captures) {
    if (!latest || Date.parse(c.capturedAt) > Date.parse(latest.capturedAt)) {
      latest = c;
    }
  }
  return latest;
}

const SYNC_LABEL: Record<CaptureSyncStatus, string> = {
  pending: strings.syncStatus.pending,
  uploading: strings.syncStatus.uploading,
  synced: strings.syncStatus.synced,
  failed: strings.syncStatus.failed,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "10:14 · ±2.8 m · waiting to sync" (local time, 24 h). */
export function formatCaptureMeta(capture: CaptureSummary): string {
  const at = new Date(capture.capturedAt);
  return [
    `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    `±${capture.accuracyM.toFixed(1)} m`,
    SYNC_LABEL[capture.syncStatus],
  ].join(" · ");
}
