import type { DeviceStatus } from "@/types/Settings";
import { FAKE_ORG } from "./fixtures";

const MB = 1_000_000;

/**
 * The device of design/screens/Settings.png in `start:mock`: an update to
 * download, storage to clear and a sync earlier today (or yesterday, before
 * 09:02).
 */
export function fakeDeviceStatus(now: Date = new Date()): DeviceStatus {
  const lastSynced = new Date(now);
  lastSynced.setHours(9, 2, 0, 0);
  if (lastSynced > now) lastSynced.setDate(lastSynced.getDate() - 1);

  return {
    project: FAKE_ORG,
    offlineSessionDays: 14,
    policy: { accuracyGateM: 4, blurFacesAndPlates: true },
    model: {
      version: "det-v1.3.0",
      update: {
        version: "v1.4.0",
        sizeBytes: 19 * MB,
        note: "better culvert detection",
      },
    },
    storage: {
      photosBytes: 900 * MB,
      syncedPhotosBytes: 780 * MB,
      mapBytes: 312 * MB,
      modelBytes: 18 * MB,
      otherBytes: 170 * MB,
    },
    offlineTiles: "Zone 3",
    signedInDevices: 2,
    lastSyncedAt: lastSynced.toISOString(),
  };
}
