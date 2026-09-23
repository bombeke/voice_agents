import type { Basemap } from "@/types/Map";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/** Kampala; used until the device reports a position. `[lng, lat]`. */
export const DEFAULT_CENTER: [number, number] = [32.5825, 0.3476];
export const DEFAULT_ZOOM = 12;
/** Zoom for "center on my location" and the first fix. */
export const LOCATE_ZOOM = 16;
/** Past this zoom every pin shows on its own. */
export const CLUSTER_MAX_ZOOM = 15;
export const CLUSTER_RADIUS = 50;

const satellite: StyleSpecification = {
  version: 8,
  // Cluster counts need glyphs; the vector styles bring their own.
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "imagery", type: "raster", source: "imagery" }],
};

/** Basemaps behind the layers button. MapLibre caches what it has shown. */
export const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
  streets: "https://tiles.openfreemap.org/styles/liberty",
  light: "https://tiles.openfreemap.org/styles/positron",
  satellite,
};

export const BASEMAPS = ["streets", "light", "satellite"] as const;
