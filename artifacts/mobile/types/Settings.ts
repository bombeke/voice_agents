export type PhotoQuality = "high" | "standard";
export type ThemePreference = "system" | "light" | "dark" | "outdoor";
export type Units = "metric" | "imperial";
export type Language = "en";
export type PhotosPerAsset = 1 | 2 | 3;

/** What the user chooses on the Settings screen; stays on this device. */
export interface DeviceSettings {
  framingGuides: boolean;
  voiceComments: boolean;
  /** Record data still syncs on mobile data; only photos wait for Wi-Fi. */
  wifiOnlyPhotos: boolean;
  backgroundSync: boolean;
  /** Server adds age and size estimates after upload. */
  cloudEnrichment: boolean;
  showAiConfidence: boolean;
  biometricUnlock: boolean;
  photosPerAsset: PhotosPerAsset;
  photoQuality: PhotoQuality;
  theme: ThemePreference;
  language: Language;
  units: Units;
}

export type BooleanSetting = {
  [K in keyof DeviceSettings]: DeviceSettings[K] extends boolean ? K : never;
}[keyof DeviceSettings];

/** A detector newer than the one on the device. */
export interface ModelUpdate {
  version: string;
  sizeBytes: number;
  /** What changed, e.g. "better culvert detection". */
  note: string;
}

/** Bytes the app holds on this device, by kind. */
export interface StorageUsage {
  photosBytes: number;
  /** The part of `photosBytes` already on the server, so safe to delete. */
  syncedPhotosBytes: number;
  mapBytes: number;
  modelBytes: number;
  /** Records, caches and logs. */
  otherBytes: number;
}

/** Facts about this device and project that the user reads but can't change. */
export interface DeviceStatus {
  /** Project the device captures for, e.g. "Pilot Zone 3". */
  project?: string;
  /** Days a signed-in session keeps working without the server. */
  offlineSessionDays: number;
  /** Set by the project administrator. */
  policy: {
    /** Capture is disabled above this horizontal accuracy (m). */
    accuracyGateM: number;
    blurFacesAndPlates: boolean;
  };
  model: { version: string; update?: ModelUpdate };
  storage: StorageUsage;
  /** Bluetooth RTK receiver name; undefined uses the phone's GNSS. */
  gnssReceiver?: string;
  /** Area whose basemap tiles are cached for offline use. */
  offlineTiles?: string;
  signedInDevices: number;
  /** ISO 8601 of the last upload that finished. */
  lastSyncedAt?: string;
}
