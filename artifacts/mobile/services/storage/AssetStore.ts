import type { MapAsset, MapPreferences } from "@/types/Map";
import { observable } from "@legendapp/state";

export const ASSETS_STORAGE_KEY = "iip_map_assets_v1";
export const MAP_PREFS_STORAGE_KEY = "iip_map_prefs_v1";

/**
 * Recorded assets the Map tab shows; persisted to MMKV by
 * `initPersistence()` in LegendState.ts. `GET /assets?bbox=` fills it later.
 */
export const mapAssets$ = observable<MapAsset[]>([]);

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
  basemap: "streets",
  cluster: true,
};

/** Basemap and clustering chosen from the layers button. */
export const mapPreferences$ = observable<MapPreferences>({
  ...DEFAULT_MAP_PREFERENCES,
});

/** Upserts by id (immutably, see addCapture) so a re-captured asset replaces its pin. */
export function upsertAsset(asset: MapAsset) {
  mapAssets$.set((prev) => {
    const i = prev.findIndex((a) => a.id === asset.id);
    return i < 0
      ? [...prev, asset]
      : prev.map((row, j) => (j === i ? asset : row));
  });
}

export function replaceAssets(assets: MapAsset[]) {
  mapAssets$.set(assets);
}

export function clearAssets() {
  mapAssets$.set([]);
}

export function setMapPreferences(prefs: Partial<MapPreferences>) {
  mapPreferences$.assign(prefs);
}
