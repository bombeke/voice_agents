import { fakeDeviceStatus } from "@/mocks/settings";
import {
  applyModelUpdate,
  clearSyncedPhotos,
  DEFAULT_SETTINGS,
  deviceStatus$,
  markSynced,
  replaceDeviceStatus,
  resetSettings,
  setSetting,
  settings$,
} from "../SettingsStore";

beforeEach(() => resetSettings());

describe("SettingsStore", () => {
  it("starts from the defaults and the admin's accuracy gate", () => {
    expect(settings$.get()).toEqual(DEFAULT_SETTINGS);
    expect(settings$.photosPerAsset.get()).toBe(3);
    expect(deviceStatus$.policy.accuracyGateM.get()).toBe(4);
    expect(deviceStatus$.lastSyncedAt.get()).toBeUndefined();
  });

  it("changes one setting and leaves the rest", () => {
    setSetting("wifiOnlyPhotos", false);
    setSetting("theme", "outdoor");
    expect(settings$.get()).toEqual({
      ...DEFAULT_SETTINGS,
      wifiOnlyPhotos: false,
      theme: "outdoor",
    });
  });

  it("records the last sync time", () => {
    markSynced(new Date("2026-09-24T09:02:00Z"));
    expect(deviceStatus$.lastSyncedAt.get()).toBe("2026-09-24T09:02:00.000Z");
  });

  it("installs an offered model update once", () => {
    replaceDeviceStatus(fakeDeviceStatus());
    expect(applyModelUpdate()).toBe(true);
    expect(deviceStatus$.model.get()).toEqual({ version: "v1.4.0" });
    expect(applyModelUpdate()).toBe(false);
  });

  it("frees only the photos already on the server", () => {
    replaceDeviceStatus(fakeDeviceStatus());
    clearSyncedPhotos();
    expect(deviceStatus$.storage.get()).toMatchObject({
      photosBytes: 120_000_000,
      syncedPhotosBytes: 0,
      mapBytes: 312_000_000,
    });
  });

  it("resets choices and device status", () => {
    setSetting("biometricUnlock", true);
    replaceDeviceStatus(fakeDeviceStatus());
    resetSettings();
    expect(settings$.biometricUnlock.get()).toBe(false);
    expect(deviceStatus$.project.get()).toBeUndefined();
  });
});
