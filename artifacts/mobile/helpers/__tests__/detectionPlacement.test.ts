import type { CaptureMetadata, CapturedDetection } from "@/types/Capture";
import {
  devicePosition,
  heightOf,
  placeDetections,
  placeFromHit,
  placeFromPixel,
} from "../detectionPlacement";

const meta = (over: Partial<CaptureMetadata> = {}): CaptureMetadata => ({
  engine: "ar",
  intrinsics: {
    width: 1000,
    height: 2000,
    focalLengthPx: 1000,
    focalLengthMm: null,
    horizontalFovDeg: 53.13,
  },
  device: {
    latitude: 0.3136,
    longitude: 32.5811,
    altitude: 1190,
    accuracy: 2.8,
    altitudeAccuracy: null,
    heading: 90,
    pitchDeg: 0,
    rollDeg: 0,
  },
  ar: {
    position: [0, 1.5, 0],
    rotation: [0, 0, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
    trackingState: "normal",
    timestamp: 0,
  },
  cameraHeightM: 1.5,
  detector: { model: "YOLO26n", inferenceMs: 31 },
  ...over,
});

const pole: CapturedDetection = {
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  // Top at y = 500 px, base at the bottom edge.
  box: { xmin: 0.4, ymin: 0.25, xmax: 0.6, ymax: 1 },
};

describe("placeFromHit", () => {
  it("projects an AR hit, and needs a pose and heading", () => {
    const hit = {
      type: "ExistingPlaneUsingExtent",
      position: [0, 0, -10] as [number, number, number],
    };
    expect(placeFromHit(meta(), hit, "ar_auto")).toMatchObject({
      distanceM: expect.closeTo(10),
      bearingDeg: expect.closeTo(90),
      source: "ar_auto",
    });
    expect(placeFromHit(meta({ ar: null }), hit, "ar_auto")).toBeNull();
    expect(
      placeFromHit(
        meta({ device: { ...meta().device, heading: null } }),
        hit,
        "ar_auto",
      ),
    ).toBeNull();
  });
});

describe("placeFromPixel", () => {
  it("meets the ground plane the AR session measured", () => {
    const p = placeFromPixel(meta(), { x: 500, y: 2000 }, "ar_tap");
    expect(p).toMatchObject({
      distanceM: expect.closeTo(1.5),
      source: "ar_tap",
      hitType: "GroundPlane",
      rough: false,
    });
  });

  it("falls back to a rough estimate without a measured ground", () => {
    const p = placeFromPixel(
      meta({ cameraHeightM: null }),
      { x: 500, y: 2000 },
      "ar_tap",
    );
    expect(p).toMatchObject({ source: "ground_estimate", rough: true });
  });

  it("finds nothing above the horizon or without a focal length", () => {
    expect(placeFromPixel(meta(), { x: 500, y: 500 }, "ar_tap")).toBeNull();
    expect(
      placeFromPixel(
        meta({ intrinsics: { ...meta().intrinsics, focalLengthPx: null } }),
        { x: 500, y: 2000 },
        "ar_tap",
      ),
    ).toBeNull();
  });
});

describe("heightOf", () => {
  it("measures from the box top and the ground point", () => {
    const position = placeFromHit(
      meta(),
      { type: "ExistingPlane", position: [0, 0, -10] },
      "ar_auto",
    );
    expect(heightOf(meta(), pole.box, position)).toBeCloseTo(6.5);
    expect(heightOf(meta(), pole.box, null)).toBeNull();
  });
});

describe("placeDetections", () => {
  it("uses the live hit when there is one, else the base pixel", () => {
    const other = { ...pole, trackId: 2 };
    const [first, second] = placeDetections(
      meta(),
      [pole, other],
      new Map([
        [
          1,
          {
            hit: {
              type: "DepthPoint",
              position: [0, 0, -10] as [number, number, number],
            },
            source: "ar_auto" as const,
          },
        ],
      ]),
    );
    expect(first.position).toMatchObject({
      hitType: "DepthPoint",
      distanceM: expect.closeTo(10),
    });
    expect(first.heightM).toBeCloseTo(6.5);
    expect(second.position).toMatchObject({ hitType: "GroundPlane" });
  });
});

describe("devicePosition", () => {
  it("is the phone's own fix", () => {
    expect(devicePosition(meta())).toMatchObject({
      latitude: 0.3136,
      longitude: 32.5811,
      distanceM: 0,
      source: "device",
      accuracyM: 2.8,
    });
  });
});

describe("without AR", () => {
  const sensorMeta = (withSensor: boolean) =>
    meta({
      engine: "camera",
      ar: null,
      cameraHeightM: null,
      sensor: withSensor
        ? {
            forward: [0, 0, -1],
            up: [0, 1, 0],
            headingDeg: 0,
            pitchDeg: 0,
            rollDeg: 0,
            trueNorth: true,
            timestamp: 0,
          }
        : null,
    });

  it("ranges detections from the sensor attitude", () => {
    const culvert: CapturedDetection = {
      ...pole,
      label: "culvert",
      // Base 150 px under the centre: 10 m at a 1.5 m lens height.
      box: { xmin: 0.45, xmax: 0.55, ymin: 0.5, ymax: (0.575 - 0.01) / 0.98 },
    };
    const [placed] = placeDetections(sensorMeta(true), [culvert]);
    expect(placed.position).toMatchObject({
      source: "sensor",
      distanceM: expect.closeTo(10, 3),
    });
  });

  it("re-places a tapped base with the sensor pose", () => {
    expect(
      placeFromPixel(sensorMeta(true), { x: 500, y: 1150 }, "ar_tap"),
    ).toMatchObject({ source: "sensor", distanceM: expect.closeTo(10, 5) });
    expect(
      placeFromPixel(sensorMeta(false), { x: 500, y: 1150 }, "ar_tap"),
    ).toBeNull();
  });

  it("leaves detections alone without any pose", () => {
    expect(placeDetections(sensorMeta(false), [pole])).toEqual([pole]);
  });
});
