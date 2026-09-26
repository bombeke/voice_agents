import type { MapPreferences } from "@/types/Map";
import { observable } from "@legendapp/state";

/** Where builds before SQLite kept the map's assets; read once by LegacyImport. */
export const ASSETS_STORAGE_KEY = "iip_map_assets_v1";
export const MAP_PREFS_STORAGE_KEY = "iip_map_prefs_v1";

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
  basemap: "streets",
  cluster: true,
};

/**
 * Basemap and clustering chosen from the layers button; persisted to MMKV by
 * `initPersistence()`. The assets themselves are in SQLite (MapAssetRepo).
 */
export const mapPreferences$ = observable<MapPreferences>({
  ...DEFAULT_MAP_PREFERENCES,
});

export function setMapPreferences(prefs: Partial<MapPreferences>) {
  mapPreferences$.assign(prefs);
}
