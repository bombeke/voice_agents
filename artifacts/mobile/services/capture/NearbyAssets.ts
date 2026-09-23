import type { NearbyAsset } from "@/types/Capture";

interface Point {
  latitude: number;
  longitude: number;
}

/**
 * Where duplicate candidates come from. On the device that is the records
 * already stored locally (`known`); the server's `/assets?bbox=` (design-doc
 * §8) joins later. Dev mocks add a fake asset beside the fix.
 */
export type NearbyAssetSource = (
  at: Point,
  known: readonly NearbyAsset[],
) => NearbyAsset[];

const local: NearbyAssetSource = (_at, known) => [...known];

let current: NearbyAssetSource = local;

export function nearbyAssets(
  at: Point,
  known: readonly NearbyAsset[],
): NearbyAsset[] {
  return current(at, known);
}

/** Pass nothing to restore the local-records source. */
export function setNearbyAssetSource(source: NearbyAssetSource = local) {
  current = source;
}
