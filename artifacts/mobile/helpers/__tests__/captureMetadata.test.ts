import {
  buildCaptureMetadata,
  focalPxFrom35mm,
  intrinsicsOf,
} from "../captureMetadata";

describe("focalPxFrom35mm", () => {
  it("scales the 35 mm equivalent by the image diagonal", () => {
    // 43.27 mm (the film diagonal) maps to the image diagonal.
    const size = { width: 3000, height: 4000 };
    expect(focalPxFrom35mm(Math.hypot(36, 24), size)).toBeCloseTo(5000);
    expect(focalPxFrom35mm(null, size)).toBeNull();
    expect(focalPxFrom35mm(0, size)).toBeNull();
  });
});

describe("intrinsicsOf", () => {
  it("derives the horizontal field of view", () => {
    const i = intrinsicsOf({ width: 1000, height: 2000 }, 500, 4.2);
    expect(i).toMatchObject({
      width: 1000,
      focalLengthPx: 500,
      focalLengthMm: 4.2,
    });
    expect(i.horizontalFovDeg).toBeCloseTo(90);
    expect(
      intrinsicsOf({ width: 1, height: 1 }, null).horizontalFovDeg,
    ).toBeNull();
  });
});

describe("buildCaptureMetadata", () => {
  const location = {
    latitude: 0.3136,
    longitude: 32.5811,
    accuracy: 2.8,
    altitude: 1190,
    satellites: 18,
    flags: [],
  };

  it("records the fix, tilt from the AR pose, and the detector", () => {
    const m = buildCaptureMetadata({
      engine: "ar",
      intrinsics: intrinsicsOf({ width: 1080, height: 2400 }, 1500),
      location,
      latest: null,
      heading: 142,
      pose: {
        position: [0, 1.5, 0],
        rotation: [0, 0, 0],
        forward: [0, 0, -1],
        up: [0, 1, 0],
        trackingState: "normal",
        timestamp: 1,
      },
      cameraHeightM: 1.5,
      model: "YOLO26n",
      inferenceMs: 31,
    });
    expect(m.device).toMatchObject({
      latitude: 0.3136,
      altitude: 1190,
      heading: 142,
      pitchDeg: expect.closeTo(0),
    });
    expect(m.cameraHeightM).toBe(1.5);
    expect(m.detector).toEqual({ model: "YOLO26n", inferenceMs: 31 });
  });

  it("leaves tilt unknown without AR", () => {
    const m = buildCaptureMetadata({
      engine: "camera",
      intrinsics: intrinsicsOf({ width: 1, height: 1 }, null),
      location,
      latest: null,
      heading: null,
      pose: null,
      cameraHeightM: null,
      model: "YOLO26n",
      inferenceMs: null,
    });
    expect(m.device.pitchDeg).toBeNull();
    expect(m.ar).toBeNull();
  });
});
