import type { AssetCategory } from "@/constants/Colors";
import { isOnline$ } from "@/services/storage/LegendState";
import type { CaptureUploader } from "@/services/sync/CaptureSync";
import type {
  CaptureSummary,
  CaptureSyncStatus,
  GnssStatus,
} from "@/types/Capture";

interface Row {
  category: AssetCategory;
  title: string;
  detail: string;
  accuracyM: number;
  syncStatus: CaptureSyncStatus;
  flagged?: boolean;
  /** Links the record to its pin in mocks/assets.ts. */
  assetId?: string;
}

/**
 * Today's fake captures behind Home and Records in `start:mock`: 14
 * captured, 11 synced (one flagged) and 3 waiting to sync, newest first.
 * Matches design/screens/Home.png and design/screens/Records sync.png.
 */
const ROWS: Row[] = [
  {
    category: "energy",
    title: "Concrete pole",
    detail: "2 detections",
    accuracyM: 2.8,
    syncStatus: "pending",
    assetId: "EP-00412",
  },
  {
    category: "energy",
    title: "Street light",
    detail: "lamp missing",
    accuracyM: 3.1,
    syncStatus: "pending",
    assetId: "EP-00415",
  },
  {
    category: "water",
    title: "Borehole · hand pump",
    detail: "functional",
    accuracyM: 2.2,
    syncStatus: "pending",
    assetId: "WS-00128",
  },
  {
    category: "roads",
    title: "Culvert · pipe",
    detail: "partly blocked",
    accuracyM: 3.6,
    syncStatus: "synced",
    flagged: true,
    assetId: "RD-00233",
  },
  {
    category: "telecom",
    title: "Telecom mast · lattice",
    detail: "6 antennas",
    accuracyM: 1.9,
    syncStatus: "synced",
    assetId: "TC-00057",
  },
  {
    category: "roads",
    title: "Potholes × 3",
    detail: "1.2 m widest",
    accuracyM: 2.9,
    syncStatus: "synced",
    assetId: "RD-00234",
  },
  {
    category: "water",
    title: "Public tap",
    detail: "leaking",
    accuracyM: 3.0,
    syncStatus: "synced",
    assetId: "WS-00129",
  },
  {
    category: "energy",
    title: "Wooden pole",
    detail: "good",
    accuracyM: 2.2,
    syncStatus: "synced",
    assetId: "EP-00413",
  },
  {
    category: "energy",
    title: "Transformer",
    detail: "rusted",
    accuracyM: 3.8,
    syncStatus: "synced",
    assetId: "EP-00414",
  },
  {
    category: "water",
    title: "Toilet block",
    detail: "functional",
    accuracyM: 2.7,
    syncStatus: "synced",
  },
  {
    category: "telecom",
    title: "Cabinet",
    detail: "door damaged",
    accuracyM: 3.4,
    syncStatus: "synced",
    assetId: "TC-00058",
  },
  {
    category: "roads",
    title: "Drain",
    detail: "silted",
    accuracyM: 3.2,
    syncStatus: "synced",
    assetId: "RD-00235",
  },
  {
    category: "energy",
    title: "Concrete pole",
    detail: "good",
    accuracyM: 2.6,
    syncStatus: "synced",
    assetId: "EP-00411",
  },
  {
    category: "water",
    title: "Water tank",
    detail: "good",
    accuracyM: 3.5,
    syncStatus: "synced",
    assetId: "WS-00130",
  },
];

/** Every seeded capture id starts with this; real ones never do. */
export const FAKE_CAPTURE_PREFIX = "fake-capture-";

export const FAKE_GNSS: GnssStatus = { bands: "L1+L5", ok: true };

export function fakeCaptures(now: Date = new Date()): CaptureSummary[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  // Spread the rows over today, never before midnight.
  const step = Math.min(
    20 * 60_000,
    (now.getTime() - startOfDay.getTime()) / ROWS.length,
  );
  return ROWS.map(({ flagged, ...row }, i) => ({
    ...row,
    id: `${FAKE_CAPTURE_PREFIX}${i + 1}`,
    capturedAt: new Date(now.getTime() - i * step).toISOString(),
    flagged: flagged ?? false,
  }));
}

/**
 * "Sync now" in `start:mock`: a short upload that succeeds while online and
 * leaves everything pending while offline, as the real queue would.
 */
export const fakeCaptureUploader: CaptureUploader = async (captures) => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (!isOnline$.peek()) return { synced: [], failed: [] };
  return { synced: captures.map((c) => c.id), failed: [] };
};
