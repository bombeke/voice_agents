import type { Vec3 } from "@/types/Capture";
import {
  boxBasePoint,
  focalFromProjection,
  groundIntersection,
  heightFromTopRay,
  offsetLatLon,
  pickGroundHit,
  pitchRoll,
  pixelRay,
  projectToGeo,
  toHitTestPoint,
  trackingStateFrom,
  wrapDegrees,
} from "../arGeometry";

const LEVEL = { forward: [0, 0, -1] as Vec3, up: [0, 1, 0] as Vec3 };
const LENS: Vec3 = [0, 1.5, 0];

const close = (a: readonly number[], b: readonly number[]) =>
  a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 5));

describe("boxBasePoint", () => {
  it("aims at the foot of the box, not its centre", () => {
    const p = boxBasePoint(
      { xmin: 0.4, ymin: 0.2, xmax: 0.6, ymax: 0.7 },
      { width: 400, height: 800 },
    );
    expect(p.x).toBeCloseTo(200);
    // 2% of the box height above ymax.
    expect(p.y).toBeCloseTo((0.7 - 0.01) * 800);
  });
});

describe("toHitTestPoint", () => {
  it("takes physical pixels on Android and points on iOS", () => {
    expect(toHitTestPoint({ x: 100.4, y: 50 }, 3, "android")).toEqual({
      x: 301,
      y: 150,
    });
    expect(toHitTestPoint({ x: 100.4, y: 50 }, 3, "ios")).toEqual({
      x: 100,
      y: 50,
    });
  });
});

describe("trackingStateFrom", () => {
  it("maps Viro's tracking constants", () => {
    expect(trackingStateFrom(3)).toBe("normal");
    expect(trackingStateFrom(2)).toBe("limited");
    expect(trackingStateFrom(1)).toBe("unavailable");
  });
});

describe("pickGroundHit", () => {
  const hit = (type: string, position: number[]) => ({
    type,
    transform: { position },
  });

  it("prefers bounded planes, then the nearest, and skips hits above the lens", () => {
    expect(
      pickGroundHit(
        [
          hit("FeaturePoint", [0, 0, -3]),
          hit("ExistingPlaneUsingExtent", [0, 0, -12]),
          hit("ExistingPlaneUsingExtent", [0, 0, -8]),
          hit("DepthPoint", [0, 2, -5]),
        ],
        LENS,
      ),
    ).toEqual({ type: "ExistingPlaneUsingExtent", position: [0, 0, -8] });
  });

  it("ignores malformed results", () => {
    expect(pickGroundHit(null, LENS)).toBeNull();
    expect(
      pickGroundHit([{ transform: { position: [0, NaN, 1] } }, {}], LENS),
    ).toBeNull();
  });
});

describe("pitchRoll", () => {
  it("reads pitch from the forward vector and roll from the right vector", () => {
    expect(pitchRoll(LEVEL).pitchDeg).toBeCloseTo(0);
    expect(pitchRoll(LEVEL).rollDeg).toBeCloseTo(0);
    const down = pitchRoll({
      forward: [0, -Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6)],
      up: [0, Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)],
    });
    expect(down.pitchDeg).toBeCloseTo(-30);
    expect(down.rollDeg).toBeCloseTo(0);
  });
});

describe("focalFromProjection", () => {
  it("divides the projected offset by its length in metres", () => {
    expect(
      focalFromProjection({ x: 540, y: 1200 }, { x: 640, y: 1200 }, 0.1),
    ).toBeCloseTo(1000);
    expect(focalFromProjection({ x: 1, y: 1 }, { x: 1, y: 1 }, 0.1)).toBeNull();
  });
});

describe("rays onto the ground", () => {
  it("casts a pixel ray and meets the ground below the lens", () => {
    const image = { width: 1000, height: 2000 };
    close(pixelRay(LEVEL, 1000, image, { x: 500, y: 1000 }), [0, 0, -1]);
    const down = pixelRay(LEVEL, 1000, image, { x: 500, y: 2000 });
    close(down, [0, -Math.SQRT1_2, -Math.SQRT1_2]);
    close(groundIntersection(LENS, down, 1.5)!, [0, 0, -1.5]);
  });

  it("finds no ground for a ray at or above the horizon", () => {
    expect(groundIntersection(LENS, [0, 0, -1], 1.5)).toBeNull();
  });

  it("measures an upright asset from its base and the ray to its top", () => {
    expect(heightFromTopRay(LENS, [0, 0, -10], [0, 0.5, -1])).toBeCloseTo(6.5);
  });
});

describe("projectToGeo", () => {
  const device = {
    latitude: 0.3136,
    longitude: 32.5811,
    altitude: 1190,
    accuracy: 2.8,
  };

  it("turns the AR offset to true north with the compass", () => {
    // Facing east (90°); the asset is 10 m straight ahead.
    const p = projectToGeo({
      device,
      heading: 90,
      pose: { position: LENS, forward: LEVEL.forward },
      point: [0, 0, -10],
      source: "ar_auto",
      hitType: "ExistingPlaneUsingExtent",
    });
    expect(p.distanceM).toBeCloseTo(10);
    expect(p.bearingDeg).toBeCloseTo(90);
    expect(p.slantDistanceM).toBeCloseTo(Math.hypot(10, 1.5));
    expect(p.latitude).toBeCloseTo(device.latitude, 7);
    expect(p.longitude).toBeGreaterThan(device.longitude);
    expect(p.altitude).toBeCloseTo(1188.5);
    // Fix, 3% range error and 5° of compass error, in quadrature.
    const projection = Math.hypot(0.3, 10 * Math.sin((5 * Math.PI) / 180));
    expect(p.projectionErrorM).toBeCloseTo(projection);
    expect(p.accuracyM).toBeCloseTo(Math.hypot(2.8, projection));
    expect(p.rough).toBe(false);
    expect(p.arPoint).toEqual([0, 0, -10]);
  });

  it("adds the asset's angle off the lens axis to the heading", () => {
    const p = projectToGeo({
      device,
      heading: 90,
      pose: { position: LENS, forward: LEVEL.forward },
      point: [10, 0, -10],
      source: "ar_tap",
      hitType: "DepthPoint",
    });
    expect(p.bearingDeg).toBeCloseTo(135);
    expect(p.latitude).toBeLessThan(device.latitude);
  });

  it("marks far and estimated points as rough", () => {
    const far = projectToGeo({
      device: { ...device, accuracy: null, altitude: null },
      heading: 0,
      pose: { position: LENS, forward: LEVEL.forward },
      point: [0, 0, -40],
      source: "ar_auto",
      hitType: "ExistingPlane",
    });
    expect(far.rough).toBe(true);
    expect(far.accuracyM).toBeNull();
    expect(far.altitude).toBeNull();
  });
});

describe("helpers", () => {
  it("wraps degrees into 0–360", () => {
    expect(wrapDegrees(-10)).toBe(350);
    expect(wrapDegrees(370)).toBe(10);
  });

  it("moves about 111 km per degree of latitude", () => {
    const { latitude } = offsetLatLon(0, 32, 0, 111_000);
    expect(latitude).toBeCloseTo(1, 1);
  });
});
