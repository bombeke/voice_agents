import type { RecordStatus } from "@/components/ui/StatusBadge";
import { strings } from "@/constants/Strings";
import { captureMetaParts } from "@/helpers/captureStats";
import { isSameLocalDay } from "@/helpers/format";
import type { CaptureSummary } from "@/types/Capture";

/** The Records tabs: everything, not yet uploaded, or routed to a supervisor. */
export type RecordFilter = "all" | "pending" | "flagged";

export const RECORD_FILTERS: readonly RecordFilter[] = [
  "all",
  "pending",
  "flagged",
];

export interface RecordCounts extends Record<RecordFilter, number> {
  /** Of the pending ones: the upload that is running, and those that failed. */
  uploading: number;
  failed: number;
}

export interface RecordSection {
  /** Local day as "YYYY-MM-DD", stable across re-renders. */
  key: string;
  title: string;
  data: CaptureSummary[];
}

const isPending = (c: CaptureSummary) => c.syncStatus !== "synced";

const MATCHES: Record<RecordFilter, (c: CaptureSummary) => boolean> = {
  all: () => true,
  pending: isPending,
  flagged: (c) => c.flagged,
};

/** Tab counts over every record on the device, not only today's. */
export function countRecords(
  captures: readonly CaptureSummary[],
): RecordCounts {
  const counts: RecordCounts = {
    all: captures.length,
    pending: 0,
    flagged: 0,
    uploading: 0,
    failed: 0,
  };
  for (const c of captures) {
    if (isPending(c)) counts.pending++;
    if (c.flagged) counts.flagged++;
    if (c.syncStatus === "uploading") counts.uploading++;
    if (c.syncStatus === "failed") counts.failed++;
  }
  return counts;
}

/** The tab, then a case-insensitive match on the name, detail, asset code or category. */
export function filterRecords(
  captures: readonly CaptureSummary[],
  filter: RecordFilter,
  query: string,
): CaptureSummary[] {
  const q = query.trim().toLowerCase();
  const matches = MATCHES[filter];
  return captures.filter(
    (c) =>
      matches(c) &&
      (!q ||
        [
          c.title,
          c.detail,
          c.assetId,
          strings.categories[c.category].label,
        ].some((field) => field?.toLowerCase().includes(q))),
  );
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dayTitle(day: Date, now: Date): string {
  if (isSameLocalDay(day, now)) return strings.records.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(day, yesterday)) return strings.records.yesterday;
  return day.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Newest first, one section per local day ("Today", "Yesterday", "Mon 21 Sept"). */
export function groupByDay(
  captures: readonly CaptureSummary[],
  now: Date = new Date(),
): RecordSection[] {
  const sorted = captures
    .map((c) => ({ c, at: new Date(c.capturedAt) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const sections: RecordSection[] = [];
  for (const { c, at } of sorted) {
    const key = dayKey(at);
    let section = sections[sections.length - 1];
    if (section?.key !== key) {
      section = { key, title: dayTitle(at, now), data: [] };
      sections.push(section);
    }
    section.data.push(c);
  }
  return sections;
}

/**
 * The one badge a row shows. A failed upload needs action first; a flagged
 * record still counts under Pending until it uploads.
 */
export function recordBadge(capture: CaptureSummary): RecordStatus {
  if (capture.syncStatus === "failed") return "failed";
  if (capture.flagged) return "flagged";
  return capture.syncStatus;
}

/** "10:14 · ±2.8 m · 2 detections". */
export function formatRecordMeta(capture: CaptureSummary): string {
  const parts: string[] = captureMetaParts(capture);
  if (capture.detail) parts.push(capture.detail);
  return parts.join(" · ");
}

/** The newest record of an asset code or capture id, e.g. from the Map's "View record". */
export function findRecord(
  captures: readonly CaptureSummary[],
  id: string,
): CaptureSummary | undefined {
  let found: CaptureSummary | undefined;
  for (const c of captures) {
    if (c.id !== id && c.assetId !== id) continue;
    if (!found || Date.parse(c.capturedAt) > Date.parse(found.capturedAt)) {
      found = c;
    }
  }
  return found;
}
