import {
  nearbyAssets,
  setNearbyAssetSource,
} from "@/services/capture/NearbyAssets";
import type { NearbyAsset } from "@/types/Capture";

const AT = { latitude: 1, longitude: 2 };
const known: NearbyAsset[] = [
  {
    id: "EP-1",
    category: "energy",
    label: "pole",
    latitude: 1,
    longitude: 2,
    capturedAt: 0,
  },
];

afterEach(() => setNearbyAssetSource());

describe("nearbyAssets", () => {
  it("returns the locally stored assets by default", () => {
    expect(nearbyAssets(AT, known)).toEqual(known);
  });

  it("uses a swapped-in source until restored", () => {
    const source = jest.fn(() => []);
    setNearbyAssetSource(source);
    expect(nearbyAssets(AT, known)).toEqual([]);
    expect(source).toHaveBeenCalledWith(AT, known);
    setNearbyAssetSource();
    expect(nearbyAssets(AT, known)).toEqual(known);
  });
});
