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
