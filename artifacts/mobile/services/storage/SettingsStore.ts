import { MAX_PHOTOS } from "@/constants/Capture";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { MAX_CAPTURE_ACCURACY_M } from "@/helpers/accuracyGate";
import type { DeviceSettings, DeviceStatus } from "@/types/Settings";
import { batch, observable } from "@legendapp/state";

export const SETTINGS_STORAGE_KEY = "iip_settings_v1";
export const DEVICE_STATUS_STORAGE_KEY = "iip_device_status_v1";

export const DEFAULT_SETTINGS: DeviceSettings = {
  framingGuides: true,
  voiceComments: true,
  wifiOnlyPhotos: true,
  backgroundSync: true,
  cloudEnrichment: true,
  showAiConfidence: true,
  biometricUnlock: false,
  photosPerAsset: MAX_PHOTOS as DeviceSettings["photosPerAsset"],
  photoQuality: "high",
  theme: "system",
  language: "en",
  units: "metric",
};

export const DEFAULT_DEVICE_STATUS: DeviceStatus = {
  offlineSessionDays: 14,
  policy: {
    accuracyGateM: MAX_CAPTURE_ACCURACY_M,
    blurFacesAndPlates: true,
  },
  model: { version: DETECTOR_MODEL_VERSION },
  storage: {
    photosBytes: 0,
    syncedPhotosBytes: 0,
    mapBytes: 0,
    modelBytes: 0,
    otherBytes: 0,
  },
  signedInDevices: 1,
};

/**
 * The user's choices on the Settings screen, and what the device knows about
 * its project, model and storage. Both are persisted to MMKV by
 * `initPersistence()` in LegendState.ts.
 */
export const settings$ = observable<DeviceSettings>({ ...DEFAULT_SETTINGS });
export const deviceStatus$ = observable<DeviceStatus>({
  ...DEFAULT_DEVICE_STATUS,
});

export function setSetting<K extends keyof DeviceSettings>(
  key: K,
  value: DeviceSettings[K],
) {
  settings$.assign({ [key]: value } as Partial<DeviceSettings>);
}

export function replaceDeviceStatus(status: DeviceStatus) {
  deviceStatus$.set(status);
}

/** Called when an upload run finishes, so "Last synced" is real. */
export function markSynced(now: Date = new Date()) {
  deviceStatus$.lastSyncedAt.set(now.toISOString());
}

/**
 * Installs the offered detector update. Returns false when none is offered.
 * TODO: download the model file; for now only the version changes.
 */
export function applyModelUpdate(): boolean {
  const update = deviceStatus$.model.update.peek();
  if (!update) return false;
  deviceStatus$.model.set({ version: update.version });
  return true;
}

/**
 * Frees the space used by photos that already reached the server.
 * TODO: delete the files through ImageStore; for now only the figures change.
 */
export function clearSyncedPhotos() {
  deviceStatus$.storage.set((s) => ({
    ...s,
    photosBytes: Math.max(0, s.photosBytes - s.syncedPhotosBytes),
    syncedPhotosBytes: 0,
  }));
}

export function resetSettings() {
  batch(() => {
    settings$.set({ ...DEFAULT_SETTINGS });
    deviceStatus$.set({ ...DEFAULT_DEVICE_STATUS });
  });
}
