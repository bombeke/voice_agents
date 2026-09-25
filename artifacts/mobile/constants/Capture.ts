import type { AssetCategory } from "@/constants/Colors";

/** Photos per asset (design-doc §3). */
export const MAX_PHOTOS = 3;

/** After this long without a GPS lock, offer saving a flagged draft (§4.3). */
export const DRAFT_OFFER_AFTER_MS = 2 * 60_000;

/** Assets of the same class closer than this are possible duplicates (§4.2). */
export const DUPLICATE_RADIUS_M = 5;

/** Inclination (degrees from vertical) from which the AI suggests "Inclined". */
export const INCLINED_FROM_DEG = 5;

/** Home tile and tagging-form order. */
export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "energy",
  "water",
  "telecom",
  "roads",
];

/** AR ground hits farther than this are kept as rough points (design: Review AI detections). */
export const AR_RELIABLE_RANGE_M = 25;

/** Lens height assumed for flat-ground estimates when AR found no ground yet. */
export const DEFAULT_CAMERA_HEIGHT_M = 1.5;

/** Compass heading error assumed when turning an AR offset into a bearing. */
export const HEADING_ERROR_DEG = 5;

/** Minimum time between AR-view detector runs; the screenshot + decode dominates. */
export const AR_DETECT_INTERVAL_MS = 250;

/** Minimum time between automatic ground raycasts for the tracked asset. */
export const AR_RAYCAST_INTERVAL_MS = 300;

/**
 * Sensor ranging (devices without ARCore / ARKit). One sigma of each input:
 * the tilt from gravity, the compass, the hand-held lens height, and the box
 * edges from the detector as a fraction of the box height.
 */
export const SENSOR_TILT_ERROR_DEG = 1;
export const SENSOR_HEADING_ERROR_DEG = 8;
/** Added to the heading error when only magnetic north is known. */
export const SENSOR_NO_DECLINATION_ERROR_DEG = 5;
export const CAMERA_HEIGHT_ERROR_M = 0.15;
export const BOX_EDGE_ERROR = 0.05;

/** Sensor-ranged positions with a larger projection error are rough points. */
export const SENSOR_ROUGH_ERROR_M = 4;

/** How often the live sensor range is recomputed for the tracked asset. */
export const SENSOR_RANGE_INTERVAL_MS = 300;

/**
 * Typical height of upright assets that stand on the ground, for ranging by
 * apparent size: metres and one sigma. Matched by substring on the detector
 * label, first match wins (so "street light" comes before "light").
 */
export const TYPICAL_ASSET_HEIGHTS: readonly {
  keyword: string;
  heightM: number;
  sigmaM: number;
}[] = [
  { keyword: "street light", heightM: 8, sigmaM: 2 },
  { keyword: "streetlight", heightM: 8, sigmaM: 2 },
  { keyword: "pole", heightM: 9, sigmaM: 1.5 },
  { keyword: "mast", heightM: 30, sigmaM: 10 },
  { keyword: "tower", heightM: 30, sigmaM: 10 },
  { keyword: "cabinet", heightM: 1.4, sigmaM: 0.3 },
  { keyword: "fire hydrant", heightM: 0.8, sigmaM: 0.15 },
  { keyword: "stop sign", heightM: 2.1, sigmaM: 0.3 },
  { keyword: "pump", heightM: 1, sigmaM: 0.25 },
  { keyword: "latrine", heightM: 2.2, sigmaM: 0.4 },
  { keyword: "tank", heightM: 3, sigmaM: 1.5 },
];
