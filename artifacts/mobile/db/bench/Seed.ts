import type { Database } from "@/db/Database";
import {
  captureRow,
  upsertOwnCaptures,
} from "@/services/storage/repos/CaptureRepo";
import { upsertAssets } from "@/services/storage/repos/MapAssetRepo";
import {
  rowFromPole,
  upsertObservationRows,
} from "@/services/storage/repos/ObservationRepo";
import type { Versioned } from "@/services/sync/ConflictResolver";
import type { AssetCategory } from "@/constants/Colors";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import type { MapAsset } from "@/types/Map";
import type { LocalPole } from "@/types/Observation";

/*
 * Benchmark data only (never imported by app code; the device benchmark
 * reaches it through the dev mocks). Synthetic records of realistic size, so
 * JSON columns and indexes behave as they will in the field.
 */

const CATEGORIES: AssetCategory[] = ["energy", "water", "telecom", "roads"];
const DAY = 86_400_000;

export interface BenchRows {
  summary: CaptureSummary;
  record: CaptureRecord;
  pole: Versioned & LocalPole;
  asset: MapAsset;
}

/** Row i of a dataset spread over the last 180 days, newest first by index. */
export function benchRow(i: number, now: number): BenchRows {
  const category = CATEGORIES[i % 4];
  const id = `bench-${String(i).padStart(6, "0")}`;
  const capturedAt = new Date(
    now - Math.floor((i * 180 * DAY) / 50_000),
  ).toISOString();
  const latitude = 0.2 + (i % 500) * 0.0004;
  const longitude = 32.4 + Math.floor(i / 500) * 0.0004;
  const syncStatus =
    i % 50 === 0 ? "pending" : i % 997 === 0 ? "failed" : "synced";
  const summary: CaptureSummary = {
    id,
    category,
    title: ["Concrete pole", "Borehole", "Telecom mast", "Culvert"][i % 4],
    detail: i % 3 === 0 ? "2 detections" : "good",
    assetId: `A-${String(i % 20_000).padStart(5, "0")}`,
    capturedAt,
    accuracyM: 1.5 + (i % 20) / 10,
    syncStatus,
    flagged: i % 37 === 0,
    capturedBy: { id: "bench-user", name: "Bench Enumerator" },
  };
  const record: CaptureRecord = {
    id,
    category,
    title: summary.title,
    assetId: summary.assetId,
    capturedAt,
    photos: [
      { uri: `file:///docs/captures/${id}-1.jpg` },
      { uri: `file:///docs/captures/${id}-2.jpg` },
    ],
    location: {
      latitude,
      longitude,
      accuracy: summary.accuracyM,
      altitude: 1190,
      satellites: 18,
      flags: [],
    },
    attributes: [
      { key: "material", value: "concrete", source: "ai", confidence: "high" },
      {
        key: "inclination",
        value: String(i % 12),
        source: "ai",
        confidence: "medium",
      },
      { key: "estimatedAge", value: "10-20", source: "user", confidence: null },
      {
        key: "vegetationCover",
        value: "partial",
        source: "ai",
        confidence: "high",
      },
      { key: "distanceFromRoad", value: null, source: "gis", confidence: null },
    ],
    statuses: ["inclined", "vegetation"],
    suggestedStatuses: ["inclined"],
    functional: "yes",
    comment: "Leaning toward the road after heavy rain; base partly exposed.",
    poleIds: [id],
    capturedBy: summary.capturedBy,
  };
  const pole = {
    pid: id,
    latitude,
    longitude,
    timestamp: Date.parse(capturedAt),
    category,
    label: "pole",
    statuses: record.statuses,
    comment: record.comment,
    accuracy: summary.accuracyM,
    confidence: 0.91,
    box: { xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.9 },
    synced: syncStatus === "synced",
    updatedAt: capturedAt,
    deviceId: "bench-device",
    vc: { "bench-device": 1 },
  } as Versioned & LocalPole;
  const asset: MapAsset = {
    id: `A-${String(i).padStart(6, "0")}`,
    category,
    label: "pole",
    title: summary.title,
    latitude,
    longitude,
    accuracyM: summary.accuracyM,
    altitude: 1190,
    statuses: record.statuses,
    functional: "yes",
    attributes: record.attributes,
    firstRecordedAt: Date.parse(capturedAt) - 30 * DAY,
    lastSeenAt: Date.parse(capturedAt),
    capturedBy: "Bench Enumerator",
    photoCount: 2,
    syncStatus,
    flagged: summary.flagged,
    comment: record.comment,
  };
  return { summary, record, pole, asset };
}

/** Writes `n` captures, observations and map assets, `batch` rows per transaction. */
export async function seedBench(
  db: Database,
  n: number,
  {
    now = Date.now(),
    batch = 1_000,
    onProgress,
  }: { now?: number; batch?: number; onProgress?: (done: number) => void } = {},
) {
  for (let start = 0; start < n; start += batch) {
    const rows = Array.from({ length: Math.min(batch, n - start) }, (_, k) =>
      benchRow(start + k, now),
    );
    await db.write(async (tx) => {
      await upsertOwnCaptures(
        tx,
        rows.map((r) => captureRow(r.summary, r.record, "mine", now)),
      );
      for (let i = 0; i < rows.length; i += 200) {
        await upsertObservationRows(
          tx,
          rows
            .slice(i, i + 200)
            .map((r) => rowFromPole(r.pole, r.summary.id, now)),
        );
      }
      await upsertAssets(
        tx,
        rows.map((r) => r.asset),
      );
    });
    onProgress?.(Math.min(n, start + batch));
  }
}
