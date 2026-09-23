import type {
  AssetStatus,
  CaptureRecord,
  CaptureSummary,
  DetectionAttribute,
} from "@/types/Capture";
import type { MapAsset } from "@/types/Map";

const DAY = 24 * 3_600_000;

/**
 * EP-00412 as design/screens/Record detail.png shows it: the AI's material,
 * inclination and cover, the surveyor's age and statuses, and the distance
 * GIS adds after sync.
 */
const POLE_ATTRIBUTES: DetectionAttribute[] = [
  { key: "material", value: "concrete", source: "ai", confidence: "high" },
  { key: "inclination", value: "7", source: "ai", confidence: "medium" },
  { key: "estimatedAge", value: "10-20", source: "user", confidence: null },
  {
    key: "vegetationCover",
    value: "partial",
    source: "ai",
    confidence: "high",
  },
  { key: "distanceFromRoad", value: null, source: "gis", confidence: null },
];

/** The AI suggested "inclined"; the surveyor added the vegetation. */
const POLE_SUGGESTED: AssetStatus[] = ["inclined"];

/** Photos per record; the mockup's pole has two. */
const photoCount = (i: number) => (i === 0 ? 2 : 1 + (i % 2));

/** Asset details for a capture, or a spot near the first asset without one. */
function recordFor(
  capture: CaptureSummary,
  asset: MapAsset | undefined,
  i: number,
  fallback: MapAsset,
): CaptureRecord {
  const at = asset ?? fallback;
  const pole = i === 0;
  // "2 detections" rows made two queued records.
  const detections =
    Number(/^(\d+) detections$/.exec(capture.detail ?? "")?.[1]) || 1;
  return {
    id: capture.id,
    category: capture.category,
    title: capture.title,
    ...(capture.assetId ? { assetId: capture.assetId } : {}),
    capturedAt: capture.capturedAt,
    photos: Array.from({ length: photoCount(i) }, () => ({ uri: null })),
    location: {
      latitude: asset ? at.latitude : at.latitude - 0.0009,
      longitude: asset ? at.longitude : at.longitude + 0.0011,
      accuracy: capture.accuracyM,
      altitude: pole ? 1203.4 : at.altitude,
      satellites: null,
      flags: [],
    },
    attributes: pole ? POLE_ATTRIBUTES : asset ? asset.attributes : [],
    statuses: asset ? [...asset.statuses] : ["good"],
    suggestedStatuses: pole
      ? POLE_SUGGESTED
      : asset
        ? [...asset.statuses]
        : ["good"],
    functional: asset?.functional ?? "yes",
    comment: pole
      ? "Leaning toward the road after heavy rain."
      : (asset?.comment ?? ""),
    poleIds: Array.from(
      { length: detections },
      (_, n) => `${capture.id}-pole-${n + 1}`,
    ),
  };
}

/**
 * Full records behind the record detail screen in `start:mock`, one per
 * fake capture (same ids, located at their Map pins), plus an August
 * inspection of EP-00412 for its condition history.
 */
export function fakeRecords(
  captures: readonly CaptureSummary[],
  assets: readonly MapAsset[],
): CaptureRecord[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const records = captures.map((c, i) =>
    recordFor(c, c.assetId ? byId.get(c.assetId) : undefined, i, assets[0]),
  );
  const pole = records.find((r) => r.assetId === "EP-00412");
  if (!pole) return records;

  const earlier = Date.parse(pole.capturedAt) - 41 * DAY;
  records.push({
    ...pole,
    id: "fake-record-ep-00412-previous",
    capturedAt: new Date(earlier).toISOString(),
    photos: [{ uri: null }],
    attributes: POLE_ATTRIBUTES.map((a) =>
      a.key === "inclination"
        ? { ...a, value: "4" }
        : a.key === "vegetationCover"
          ? { ...a, value: "none" }
          : a,
    ),
    statuses: ["inclined"],
    suggestedStatuses: ["inclined"],
    comment: "",
    poleIds: ["fake-record-ep-00412-previous-pole-1"],
  });
  return records;
}
