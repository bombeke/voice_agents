import { strings } from "@/constants/Strings";
import { fill, formatClock } from "@/helpers/format";
import { formatDate } from "@/helpers/mapAssets";
import type {
  AssetStatus,
  AttributeSource,
  CaptureRecord,
  DetectionAttribute,
} from "@/types/Capture";

const d = strings.records.detail;

/** "22 Sep 2026, 10:14" (local time). */
export function formatCapturedAt(iso: string): string {
  const at = new Date(iso);
  return `${formatDate(at.getTime())}, ${formatClock(at)}`;
}

/** "EP-00412 · captured 22 Sep 2026, 10:14", or without the code. */
export function formatCapturedLine(
  record: Pick<CaptureRecord, "assetId" | "capturedAt">,
): string {
  const when = formatCapturedAt(record.capturedAt);
  return record.assetId
    ? fill(d.captured, { id: record.assetId, when })
    : fill(d.capturedNoId, { when });
}

const sameSet = (a: readonly AssetStatus[], b: readonly AssetStatus[]) =>
  a.length === b.length && a.every((s) => b.includes(s));

/** The AI's suggestion kept as is, else the surveyor's. */
export function statusSource(
  record: Pick<CaptureRecord, "statuses" | "suggestedStatuses">,
): AttributeSource {
  return record.statuses.length > 0 &&
    sameSet(record.statuses, record.suggestedStatuses)
    ? "ai"
    : "user";
}

/** "Inclined, covered by vegetation"; null when none were recorded. */
export function formatStatuses(
  statuses: readonly AssetStatus[],
): string | null {
  if (statuses.length === 0) return null;
  return capitalise(
    statuses.map((s) => strings.capture.statuses[s].toLowerCase()).join(", "),
  );
}

/**
 * The attribute card's rows around the Status row: the measured attributes,
 * then (after Status) the ones GIS works out on the server.
 */
export function splitAttributes(attributes: readonly DetectionAttribute[]): {
  before: DetectionAttribute[];
  after: DetectionAttribute[];
} {
  return {
    before: attributes.filter((a) => a.source !== "gis"),
    after: attributes.filter((a) => a.source === "gis"),
  };
}

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const valueOf = (record: CaptureRecord, key: DetectionAttribute["key"]) =>
  record.attributes.find((a) => a.key === key)?.value ?? null;

/**
 * One line for the condition history, e.g. "Inclined 7°, partial
 * vegetation". Measured values replace the bare statuses they explain.
 */
export function conditionSummary(record: CaptureRecord): string {
  const c = d.condition;
  const parts: string[] = [];
  const degrees = valueOf(record, "inclination");
  const cover = valueOf(record, "vegetationCover") as
    keyof typeof c.vegetation | null;

  for (const status of record.statuses) {
    if (status === "inclined" && degrees) {
      parts.push(fill(c.inclined, { value: degrees }));
    } else if (status === "vegetation" && cover) {
      continue; // Said by the cover below.
    } else {
      parts.push(strings.capture.statuses[status].toLowerCase());
    }
  }
  if (cover && c.vegetation[cover]) parts.push(c.vegetation[cover]);
  return parts.length ? capitalise(parts.join(", ")) : c.none;
}

export interface HistoryEntry {
  id: string;
  title: string;
  summary: string;
  current: boolean;
}

/**
 * Every capture of the record's asset on the device, newest first, with
 * this one marked. A record without an asset code only has itself.
 */
export function recordHistory(
  records: Readonly<Record<string, CaptureRecord>>,
  record: CaptureRecord,
): HistoryEntry[] {
  const same = record.assetId
    ? Object.values(records).filter((r) => r.assetId === record.assetId)
    : [];
  if (!same.some((r) => r.id === record.id)) same.push(record);
  return same
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
    .map((r) => {
      const date = formatDate(Date.parse(r.capturedAt));
      const current = r.id === record.id;
      return {
        id: r.id,
        title: current ? fill(d.thisCapture, { date }) : date,
        summary: conditionSummary(r),
        current,
      };
    });
}

/** "1 of 2 photos", or "1 photo" when there is only one. */
export function photoCounter(index: number, count: number): string {
  return count === 1
    ? d.photoOne
    : fill(d.photoCount, { index: index + 1, count });
}
