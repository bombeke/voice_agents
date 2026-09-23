import type { AssetCategory } from "@/constants/Colors";
import type {
  CaptureSummary,
  CaptureSyncStatus,
  GnssStatus,
} from "@/types/Capture";

/**
 * Today's fake captures behind the Home screen in `start:mock`: 14 captured,
 * 11 synced (one flagged) and 3 waiting to sync, newest first. Matches
 * design/screens/Home.png.
 */
const ROWS: [AssetCategory, string, number, CaptureSyncStatus, boolean?][] = [
  ["energy", "Concrete pole · inclined 7°", 2.8, "pending"],
  ["water", "Borehole · hand pump working", 3.1, "pending"],
  ["roads", "Culvert · partly blocked", 3.6, "pending"],
  ["energy", "Street light · not working", 2.4, "synced"],
  ["telecom", "Telecom mast · good", 3.3, "synced"],
  ["roads", "Pothole · 1.2 m wide", 2.9, "synced", true],
  ["water", "Public tap · leaking", 3.0, "synced"],
  ["energy", "Wooden pole · good", 2.2, "synced"],
  ["energy", "Transformer · rusted", 3.8, "synced"],
  ["water", "Toilet block · functional", 2.7, "synced"],
  ["telecom", "Cabinet · door damaged", 3.4, "synced"],
  ["roads", "Drain · silted", 3.2, "synced"],
  ["energy", "Concrete pole · good", 2.6, "synced"],
  ["water", "Water tank · good", 3.5, "synced"],
];

export const FAKE_GNSS: GnssStatus = { bands: "L1+L5", ok: true };

export function fakeCaptures(now: Date = new Date()): CaptureSummary[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  // Spread the rows over today, never before midnight.
  const step = Math.min(
    20 * 60_000,
    (now.getTime() - startOfDay.getTime()) / ROWS.length,
  );
  return ROWS.map(([category, title, accuracyM, syncStatus, flagged], i) => ({
    id: `fake-capture-${i + 1}`,
    category,
    title,
    capturedAt: new Date(now.getTime() - i * step).toISOString(),
    accuracyM,
    syncStatus,
    flagged: flagged ?? false,
  }));
}
