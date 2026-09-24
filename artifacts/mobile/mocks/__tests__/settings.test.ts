import { fakeDeviceStatus } from "../settings";

describe("fakeDeviceStatus", () => {
  it("matches the Settings mockup", () => {
    const status = fakeDeviceStatus(new Date(2026, 8, 24, 14, 0));
    expect(status).toMatchObject({
      project: "Pilot Zone 3",
      offlineSessionDays: 14,
      model: {
        version: "det-v1.3.0",
        update: { version: "v1.4.0", sizeBytes: 19_000_000 },
      },
      signedInDevices: 2,
      offlineTiles: "Zone 3",
    });
    expect(new Date(status.lastSyncedAt!)).toEqual(new Date(2026, 8, 24, 9, 2));
  });

  it("never syncs in the future: before 09:02 it was yesterday", () => {
    const status = fakeDeviceStatus(new Date(2026, 8, 24, 7, 0));
    expect(new Date(status.lastSyncedAt!)).toEqual(new Date(2026, 8, 23, 9, 2));
  });

  it("only offers synced photos for clearing", () => {
    const { storage } = fakeDeviceStatus();
    expect(storage.syncedPhotosBytes).toBeLessThanOrEqual(storage.photosBytes);
  });
});
