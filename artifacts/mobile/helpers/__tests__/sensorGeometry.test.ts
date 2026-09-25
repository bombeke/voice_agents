import type {
  CaptureMetadata,
  NormalizedBox,
  SensorCameraPose,
  Vec3,
} from "@/types/Capture";
import {
  cameraPoseFromSensors,
  fuseRanges,
  placePixelWithSensors,
  placeWithSensors,
  typicalHeightFor,
} from "../sensorGeometry";

const G = 9.81;
/** Northern-hemisphere field: 20 µT north, 40 µT down (dip ~63°). */
const field = (north: Vec3, down: Vec3): Vec3 => [
  north[0] * 20 + down[0] * 40,
  north[1] * 20 + down[1] * 40,
  north[2] * 20 + down[2] * 40,
];

/** Portrait, upright, lens level: phone -y is down. */
const UPRIGHT_DOWN: Vec3 = [0, -1, 0];
const gravityUpright: Vec3 = [0, -G, 0];

const reading = (magnetic: Vec3, over = {}) => ({
  gravity: gravityUpright,
  magnetic,
  declinationDeg: 0,
  timestamp: 1,
  ...over,
});

describe("cameraPoseFromSensors", () => {
  it("points the lens north when the back of the phone faces north", () => {
    // The lens looks along phone -z, so north is -z.
    const pose = cameraPoseFromSensors(
      reading(field([0, 0, -1], UPRIGHT_DOWN)),
    );
    expect(pose).not.toBeNull();
    expect(pose!.headingDeg).toBeCloseTo(0, 5);
    expect(pose!.pitchDeg).toBeCloseTo(0, 5);
    expect(pose!.rollDeg).toBeCloseTo(0, 5);
    expect(pose!.forward[2]).toBeCloseTo(-1, 5);
    expect(pose!.up[1]).toBeCloseTo(1, 5);
    expect(pose!.trueNorth).toBe(true);
  });

  it("reads east when the phone's left edge points north", () => {
    const pose = cameraPoseFromSensors(
      reading(field([-1, 0, 0], UPRIGHT_DOWN)),
    );
    expect(pose!.headingDeg).toBeCloseTo(90, 5);
  });

  it("adds the declination to turn magnetic into true north", () => {
    const pose = cameraPoseFromSensors(
      reading(field([0, 0, -1], UPRIGHT_DOWN), { declinationDeg: 10 }),
    );
    expect(pose!.headingDeg).toBeCloseTo(10, 5);
  });

  it("flags magnetic north when the declination is unknown", () => {
    const pose = cameraPoseFromSensors(
      reading(field([0, 0, -1], UPRIGHT_DOWN), { declinationDeg: null }),
    );
    expect(pose!.trueNorth).toBe(false);
  });

  it("measures the lens pitch from gravity", () => {
    // Tipped 30° forward: the lens looks down, gravity gains a -z share.
    const a = (30 * Math.PI) / 180;
    const down: Vec3 = [0, -Math.cos(a), -Math.sin(a)];
    const north: Vec3 = [0, -Math.sin(a), Math.cos(a) * -1];
    const pose = cameraPoseFromSensors(
      reading(field(north, down), {
        gravity: [0, -G * Math.cos(a), -G * Math.sin(a)],
      }),
    );
    expect(pose!.pitchDeg).toBeCloseTo(-30, 3);
    expect(pose!.headingDeg).toBeCloseTo(0, 3);
  });

  it("keeps the photo upright when the phone is held landscape", () => {
    // Phone +x points down, so the photo's up is phone -x.
    const down: Vec3 = [1, 0, 0];
    const pose = cameraPoseFromSensors(
      reading(field([0, 0, -1], down), { gravity: [G, 0, 0] }),
    );
    expect(pose!.up[1]).toBeCloseTo(1, 5);
    expect(pose!.rollDeg).toBeCloseTo(0, 5);
    expect(pose!.headingDeg).toBeCloseTo(0, 5);
  });

  it("gives up without a horizontal field or without readings", () => {
    expect(cameraPoseFromSensors(reading([0, -40, 0]))).toBeNull();
    expect(cameraPoseFromSensors(reading([0, 0, 0]))).toBeNull();
    expect(
      cameraPoseFromSensors(
        reading(field([0, 0, -1], UPRIGHT_DOWN), { gravity: [0, 0, 0] }),
      ),
    ).toBeNull();
  });
});

describe("typicalHeightFor", () => {
  it("matches detector labels by keyword", () => {
    expect(typicalHeightFor("concrete_pole")?.heightM).toBe(9);
    expect(typicalHeightFor("street-light")?.heightM).toBe(8);
    expect(typicalHeightFor("person")).toBeNull();
  });
});

describe("fuseRanges", () => {
  it("weights each range by its inverse variance", () => {
    const fused = fuseRanges([
      { distanceM: 10, sigmaM: 1 },
      { distanceM: 12, sigmaM: 2 },
    ]);
    // (10/1 + 12/4) / (1 + 1/4) = 10.4
    expect(fused!.distanceM).toBeCloseTo(10.4, 5);
    // The spread (1.6 m to the far one) outweighs sqrt(1/1.25).
    expect(fused!.sigmaM).toBeCloseTo(1.6, 5);
  });

  it("keeps a single range and drops missing ones", () => {
    expect(fuseRanges([null, { distanceM: 8, sigmaM: 0.5 }])).toEqual({
      distanceM: 8,
      sigmaM: 0.5,
    });
    expect(fuseRanges([null, null])).toBeNull();
  });
});

const FOCAL = 1000;
const IMAGE = { width: 1000, height: 2000, focalLengthPx: FOCAL };
const DEVICE: CaptureMetadata["device"] = {
  latitude: 0.3136,
  longitude: 32.5811,
  altitude: 1190,
  accuracy: 2.8,
  altitudeAccuracy: null,
  heading: 0,
  pitchDeg: 0,
  rollDeg: 0,
};
const NORTH_LEVEL: SensorCameraPose = {
  forward: [0, 0, -1],
  up: [0, 1, 0],
  headingDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  trueNorth: true,
  timestamp: 1,
};

/**
 * The box a 9 m pole 10 m ahead makes with the lens 1.5 m up: top 7.5 m
 * above the axis, base 1.5 m below (the base point sits 2% of the box up).
 */
function poleBox(distance = 10, height = 9, lens = 1.5): NormalizedBox {
  const cy = IMAGE.height / 2;
  const top = (cy - (FOCAL * (height - lens)) / distance) / IMAGE.height;
  const base = (cy + (FOCAL * lens) / distance) / IMAGE.height;
  // base = ymax − 0.02 (ymax − ymin)
  const ymax = (base - 0.02 * top) / 0.98;
  return { xmin: 0.45, xmax: 0.55, ymin: top, ymax };
}

describe("placeWithSensors", () => {
  it("ranges a pole by ground plane and size, and places it ahead", () => {
    const placed = placeWithSensors({
      device: DEVICE,
      pose: NORTH_LEVEL,
      intrinsics: IMAGE,
      box: poleBox(),
      label: "pole",
    })!;
    expect(placed.ground!.distanceM).toBeCloseTo(10, 5);
    expect(placed.size!.distanceM).toBeCloseTo(10, 5);
    expect(placed.position.distanceM).toBeCloseTo(10, 5);
    expect(placed.position.source).toBe("sensor");
    expect(placed.position.latitude).toBeGreaterThan(DEVICE.latitude);
    expect(placed.position.longitude).toBeCloseTo(DEVICE.longitude, 7);
    expect(placed.position.altitude).toBeCloseTo(1190 - 1.5, 5);
    expect(placed.heightM).toBeCloseTo(9, 5);
    // Fused error beats either method alone.
    expect(placed.position.projectionErrorM).toBeLessThan(
      Math.hypot(placed.ground!.sigmaM, 10 * Math.sin((8 * Math.PI) / 180)) +
        1e-9,
    );
    expect(placed.position.accuracyM!).toBeGreaterThan(2.8);
  });

  it("uses the ground alone for classes without a typical height", () => {
    const placed = placeWithSensors({
      device: DEVICE,
      pose: NORTH_LEVEL,
      intrinsics: IMAGE,
      box: poleBox(),
      label: "culvert",
    })!;
    expect(placed.size).toBeNull();
    expect(placed.position.distanceM).toBeCloseTo(10, 5);
  });

  it("uses the size alone when the base ray doesn't reach the ground", () => {
    // A 9 m pole standing 1.5 m above the lens: its base is on the horizon.
    const placed = placeWithSensors({
      device: DEVICE,
      pose: NORTH_LEVEL,
      intrinsics: IMAGE,
      box: poleBox(10, 9, 0),
      label: "pole",
    })!;
    expect(placed.ground).toBeNull();
    expect(placed.position.distanceM).toBeCloseTo(10, 1);
    expect(placed.heightM).toBeNull();
  });

  it("marks far or uncertain sensor ranges as rough", () => {
    const placed = placeWithSensors({
      device: DEVICE,
      pose: NORTH_LEVEL,
      intrinsics: IMAGE,
      box: poleBox(40),
      label: "pole",
    })!;
    expect(placed.position.rough).toBe(true);
  });

  it("can't range a box cut off at the bottom, or without a focal length", () => {
    const cut = { ...poleBox(), ymax: 1 };
    expect(
      placeWithSensors({
        device: DEVICE,
        pose: NORTH_LEVEL,
        intrinsics: IMAGE,
        box: cut,
        label: "pole",
      }),
    ).toBeNull();
    expect(
      placeWithSensors({
        device: DEVICE,
        pose: NORTH_LEVEL,
        intrinsics: { ...IMAGE, focalLengthPx: null },
        box: poleBox(),
        label: "pole",
      }),
    ).toBeNull();
  });

  it("turns the bearing with the lens heading", () => {
    const east: SensorCameraPose = {
      ...NORTH_LEVEL,
      forward: [1, 0, 0],
      headingDeg: 90,
    };
    const placed = placeWithSensors({
      device: DEVICE,
      pose: east,
      intrinsics: IMAGE,
      box: poleBox(),
      label: "pole",
    })!;
    expect(placed.position.bearingDeg).toBeCloseTo(90, 5);
    expect(placed.position.longitude).toBeGreaterThan(DEVICE.longitude);
  });
});

describe("placePixelWithSensors", () => {
  it("places a tapped base on flat ground below the lens", () => {
    // 1.5 m below at 10 m: 150 px under the centre.
    const position = placePixelWithSensors(
      {
        device: DEVICE,
        intrinsics: { ...IMAGE, focalLengthMm: null, horizontalFovDeg: null },
      },
      NORTH_LEVEL,
      { x: 500, y: 1150 },
    );
    expect(position!.distanceM).toBeCloseTo(10, 5);
    expect(position!.source).toBe("sensor");
  });

  it("returns null for a tap above the horizon", () => {
    expect(
      placePixelWithSensors(
        {
          device: DEVICE,
          intrinsics: { ...IMAGE, focalLengthMm: null, horizontalFovDeg: null },
        },
        NORTH_LEVEL,
        { x: 500, y: 800 },
      ),
    ).toBeNull();
  });
});
