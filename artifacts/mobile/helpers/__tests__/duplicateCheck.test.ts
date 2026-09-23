import {
  assetFromPole,
  distanceM,
  findDuplicate,
} from "@/helpers/duplicateCheck";
import type { NearbyAsset } from "@/types/Capture";

const AT = { latitude: 0.313612, longitude: 32.581104 };
/** Metres north of AT. */
const north = (m: number) => AT.latitude + m / 111_320;

const asset = (over: Partial<NearbyAsset> = {}): NearbyAsset => ({
  id: "EP-00412",
  category: "energy",
  label: "pole",
  latitude: north(3.2),
  longitude: AT.longitude,
  capturedAt: 0,
  ...over,
});

describe("distanceM", () => {
  it("measures short distances to the centimetre", () => {
    expect(distanceM(AT, { ...AT, latitude: north(3.2) })).toBeCloseTo(3.2, 1);
    expect(distanceM(AT, AT)).toBe(0);
  });
});

describe("findDuplicate", () => {
  it("finds the nearest asset of the same class within 5 m", () => {
    const found = findDuplicate(AT, "energy", "pole", [
      asset({ id: "far", latitude: north(4.5) }),
      asset(),
    ]);
    expect(found?.id).toBe("EP-00412");
    expect(found?.distanceM).toBeCloseTo(3.2, 1);
  });

  it("ignores other categories and classes, and anything 5 m or further", () => {
    expect(
      findDuplicate(AT, "energy", "pole", [
        asset({ category: "telecom" }),
        asset({ label: "street light" }),
        asset({ latitude: north(5.1) }),
      ]),
    ).toBeNull();
  });

  it("matches on category alone when a class is missing", () => {
    expect(findDuplicate(AT, "energy", null, [asset()])).not.toBeNull();
    expect(
      findDuplicate(AT, "energy", "POLE", [asset({ label: null })]),
    ).not.toBeNull();
  });
});

describe("assetFromPole", () => {
  it("prefers the server asset code and keeps what the check needs", () => {
    expect(
      assetFromPole({
        pid: "uuid-1",
        dhis2Id: "EP-00412",
        category: "energy",
        label: "pole",
        latitude: 1,
        longitude: 2,
        timestamp: 5,
      }),
    ).toEqual({
      id: "EP-00412",
      category: "energy",
      label: "pole",
      latitude: 1,
      longitude: 2,
      capturedAt: 5,
    });
  });

  it("skips deleted, uncategorised or unlocated records", () => {
    const pole = {
      pid: "p",
      category: "energy" as const,
      latitude: 1,
      longitude: 2,
    };
    expect(assetFromPole({ ...pole, deleted: true })).toBeNull();
    expect(assetFromPole({ ...pole, category: undefined })).toBeNull();
    expect(assetFromPole({ ...pole, latitude: undefined })).toBeNull();
    expect(assetFromPole({ ...pole, pid: undefined })).toBeNull();
  });
});
