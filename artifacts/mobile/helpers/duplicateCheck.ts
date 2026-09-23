import { DUPLICATE_RADIUS_M } from "@/constants/Capture";
import type { AssetCategory } from "@/constants/Colors";
import type { LocalPole } from "@/services/storage/LegendState";
import type { DuplicateCandidate, NearbyAsset } from "@/types/Capture";

interface Point {
  latitude: number;
  longitude: number;
}

/** Mean Earth radius (IUGG), metres. */
const EARTH_RADIUS_M = 6_371_008.8;

const radians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function distanceM(a: Point, b: Point): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const sameClass = (a: string | null, b: string | null) =>
  a === null || b === null || a.toLowerCase() === b.toLowerCase();

/**
 * The nearest asset of the same category and class within 5 m (§4.2), or
 * null. A missing class on either side matches on category alone.
 */
export function findDuplicate(
  at: Point,
  category: AssetCategory,
  label: string | null,
  assets: readonly NearbyAsset[],
): DuplicateCandidate | null {
  let best: DuplicateCandidate | null = null;
  for (const asset of assets) {
    if (asset.category !== category || !sameClass(asset.label, label)) {
      continue;
    }
    const d = distanceM(at, asset);
    if (d < DUPLICATE_RADIUS_M && (!best || d < best.distanceM)) {
      best = { ...asset, distanceM: d };
    }
  }
  return best;
}

/** A stored record as a duplicate-check candidate; null if it can't be one. */
export function assetFromPole(pole: LocalPole): NearbyAsset | null {
  const id = pole.dhis2Id ?? pole.pid;
  if (
    !id ||
    pole.deleted ||
    !pole.category ||
    pole.latitude == null ||
    pole.longitude == null
  ) {
    return null;
  }
  return {
    id,
    category: pole.category,
    label: pole.label ?? null,
    latitude: pole.latitude,
    longitude: pole.longitude,
    capturedAt: pole.timestamp ?? 0,
  };
}
