import { distance, snapToNearestPole } from "../SnapToPole";

// ~1.11 m per 0.00001° of latitude.
const origin = { lat: 0.3476, lng: 32.5825 };
const north = (m: number) => ({
  lat: origin.lat + m / 111_195,
  lng: origin.lng,
});

describe("distance", () => {
  it("is zero for the same point", () => {
    expect(distance(origin, origin)).toBe(0);
  });

  it("measures metres along a meridian", () => {
    expect(distance(origin, north(100))).toBeCloseTo(100, 1);
  });

  it("is symmetric", () => {
    const a = north(37);
    expect(distance(origin, a)).toBeCloseTo(distance(a, origin), 9);
  });
});

describe("snapToNearestPole", () => {
  const near = { id: "near", ...north(3) };
  const nearer = { id: "nearer", ...north(1.5) };
  const far = { id: "far", ...north(50) };

  it("returns the closest pole inside the radius", () => {
    expect(snapToNearestPole(origin, [near, far, nearer])).toBe(nearer);
  });

  it("returns null when every pole is outside the radius", () => {
    expect(snapToNearestPole(origin, [far])).toBeNull();
  });

  it("honours a custom radius", () => {
    expect(snapToNearestPole(origin, [near], 2)).toBeNull();
    expect(snapToNearestPole(origin, [far], 60)).toBe(far);
  });

  it("returns null for an empty list", () => {
    expect(snapToNearestPole(origin, [])).toBeNull();
  });
});
