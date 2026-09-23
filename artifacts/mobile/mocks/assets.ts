import type { AssetCategory } from "@/constants/Colors";
import { CATEGORY_ATTRIBUTES } from "@/constants/Attributes";
import { DEFAULT_CENTER } from "@/constants/Map";
import type {
  AssetStatus,
  AttributeKey,
  CaptureSyncStatus,
  DetectionAttribute,
  Functional,
} from "@/types/Capture";
import type { MapAsset } from "@/types/Map";

/** Metres per degree of latitude (and of longitude at the equator). */
const M_PER_DEG = 111_320;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Row {
  id: string;
  category: AssetCategory;
  label: string;
  title: string;
  /** Offset from the map's default centre, in metres [east, north]. */
  at: [number, number];
  statuses: AssetStatus[];
  values?: Partial<Record<AttributeKey, string>>;
  functional?: Functional;
  /** Hours since the last capture. */
  seenHoursAgo: number;
  syncStatus?: CaptureSyncStatus;
  flagged?: boolean;
  comment?: string;
}

/**
 * Fake assets behind the Map tab in `start:mock`, laid out like
 * design/screens/Map.png: poles along the main road, water points to the
 * south-west, a mast to the north-east, and a tight group of poles to the
 * north-west that clusters when zoomed out.
 */
const ROWS: Row[] = [
  {
    id: "EP-00412",
    category: "energy",
    label: "pole",
    title: "Concrete pole",
    at: [0, 0],
    statuses: ["inclined", "vegetation"],
    values: {
      material: "concrete",
      inclination: "7",
      vegetationCover: "partial",
    },
    seenHoursAgo: 0.5,
    syncStatus: "pending",
    comment: "Leaning towards the road after the April rains.",
  },
  {
    id: "EP-00411",
    category: "energy",
    label: "pole",
    title: "Concrete pole",
    at: [-120, 10],
    statuses: ["good"],
    values: { material: "concrete", inclination: "0" },
    seenHoursAgo: 1,
  },
  {
    id: "EP-00413",
    category: "energy",
    label: "pole",
    title: "Wooden pole",
    at: [130, 15],
    statuses: ["rust", "vegetation"],
    values: { material: "wood", vegetationCover: "heavy", estimatedAge: "20+" },
    seenHoursAgo: 26,
  },
  {
    id: "EP-00414",
    category: "energy",
    label: "transformer",
    title: "Transformer",
    at: [290, 35],
    statuses: ["rust"],
    values: { material: "metal", estimatedAge: "10-20" },
    functional: "yes",
    seenHoursAgo: 50,
  },
  {
    id: "EP-00415",
    category: "energy",
    label: "street_light",
    title: "Street light",
    at: [10, 150],
    statuses: ["good"],
    values: { material: "metal" },
    functional: "no",
    seenHoursAgo: 3,
    flagged: true,
    comment: "Lamp head missing.",
  },
  {
    id: "WS-00128",
    category: "water",
    label: "borehole",
    title: "Borehole",
    at: [-60, -160],
    statuses: ["good"],
    values: { estimatedSize: "small", estimatedAge: "5-10" },
    functional: "yes",
    seenHoursAgo: 2,
    syncStatus: "pending",
  },
  {
    id: "WS-00129",
    category: "water",
    label: "tap",
    title: "Public tap",
    at: [-170, -270],
    statuses: ["leaking"],
    values: { material: "metal" },
    functional: "yes",
    seenHoursAgo: 5,
  },
  {
    id: "WS-00130",
    category: "water",
    label: "tank",
    title: "Water tank",
    at: [230, -310],
    statuses: ["cracked"],
    values: { material: "concrete", estimatedSize: "large" },
    functional: "unknown",
    seenHoursAgo: 72,
    syncStatus: "failed",
  },
  {
    id: "TC-00057",
    category: "telecom",
    label: "mast",
    title: "Telecom mast",
    at: [160, 220],
    statuses: ["good"],
    values: { material: "metal", inclination: "0" },
    seenHoursAgo: 8,
  },
  {
    id: "TC-00058",
    category: "telecom",
    label: "cabinet",
    title: "Cabinet",
    at: [360, 260],
    statuses: ["vandalised"],
    values: { material: "metal" },
    functional: "no",
    seenHoursAgo: 30,
    flagged: true,
    comment: "Door forced open.",
  },
  {
    id: "RD-00233",
    category: "roads",
    label: "culvert",
    title: "Culvert",
    at: [-10, 180],
    statuses: ["blocked", "vegetation"],
    values: { estimatedSize: "medium", vegetationCover: "partial" },
    seenHoursAgo: 4,
    syncStatus: "pending",
  },
  {
    id: "RD-00234",
    category: "roads",
    label: "pothole",
    title: "Pothole",
    at: [-5, -440],
    statuses: ["potholes"],
    values: { estimatedSize: "large" },
    seenHoursAgo: 6,
  },
  {
    id: "RD-00235",
    category: "roads",
    label: "drain",
    title: "Drain",
    at: [-300, -60],
    statuses: ["eroded"],
    values: { estimatedSize: "small" },
    seenHoursAgo: 96,
  },
];

/** A dozen poles on the north-west feeder, close enough to cluster. */
const FEEDER: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: `EP-${String(301 + i).padStart(5, "0")}`,
  category: "energy",
  label: "pole",
  title: i % 3 === 0 ? "Wooden pole" : "Concrete pole",
  at: [-1400 + (i % 4) * 45, 1300 + Math.floor(i / 4) * 45],
  statuses: i % 5 === 0 ? ["inclined"] : ["good"],
  values: {
    material: i % 3 === 0 ? "wood" : "concrete",
    inclination: i % 5 === 0 ? "12" : "0",
  },
  seenHoursAgo: 24 * (3 + i),
}));

const SURVEYORS = ["Grace Nakato", "Joseph Okello", "Amina Nansubuga"];

const CONFIDENCE = ["high", "medium", "high", "low"] as const;

function attributes(row: Row): DetectionAttribute[] {
  return CATEGORY_ATTRIBUTES[row.category].map((key, i) => {
    if (key === "distanceFromRoad") {
      return {
        key,
        value: String(4 + (i % 3) * 3),
        source: "gis",
        confidence: null,
      };
    }
    const value = row.values?.[key] ?? null;
    if (value === null) {
      return { key, value: null, source: "ai", confidence: null };
    }
    // Surveyors corrected the material on codes ending in 1.
    if (key === "material" && row.id.endsWith("1")) {
      return { key, value, source: "user", confidence: null };
    }
    return {
      key,
      value,
      source: "ai",
      confidence: CONFIDENCE[(row.id.length + i) % CONFIDENCE.length],
    };
  });
}

export function fakeMapAssets(now: Date = new Date()): MapAsset[] {
  const [lng0, lat0] = DEFAULT_CENTER;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return [...ROWS, ...FEEDER].map((row, i) => {
    const lastSeenAt = now.getTime() - row.seenHoursAgo * HOUR;
    return {
      id: row.id,
      category: row.category,
      label: row.label,
      title: row.title,
      latitude: lat0 + row.at[1] / M_PER_DEG,
      longitude: lng0 + row.at[0] / (M_PER_DEG * cos),
      accuracyM: 2.2 + (i % 7) * 0.25,
      altitude: 1190 + (i % 5) * 3,
      statuses: row.statuses,
      functional: row.functional ?? "unknown",
      attributes: attributes(row),
      firstRecordedAt: lastSeenAt - (90 + i * 7) * DAY,
      lastSeenAt,
      capturedBy: SURVEYORS[i % SURVEYORS.length],
      photoCount: 1 + (i % 3),
      syncStatus: row.syncStatus ?? "synced",
      flagged: row.flagged ?? false,
      comment: row.comment ?? "",
    };
  });
}
