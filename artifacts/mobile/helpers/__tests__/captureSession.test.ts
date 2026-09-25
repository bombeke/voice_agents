import { locationFrom, mergeDetections } from "@/helpers/captureSession";
import type {
  CapturedDetection,
  CapturedPhoto,
  GnssFix,
} from "@/types/Capture";

const detection = (trackId: number, confidence: number): CapturedDetection => ({
  trackId,
  label: "pole",
  confidence,
  box: { xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.9 },
});

const fix = (over: Partial<GnssFix> = {}): GnssFix => ({
  latitude: 1,
  longitude: 2,
  altitude: null,
  accuracy: 6,
  altitudeAccuracy: null,
  timestamp: 0,
  mocked: false,
  satellites: null,
  fixType: null,
  bands: null,
  ...over,
});

describe("locationFrom", () => {
  const averaged = {
    latitude: 5,
    longitude: 6,
    altitude: 1203.4,
    accuracy: 2.9,
    fixes: [],
  };

  it("stamps the averaged fix when the gate passed", () => {
    expect(locationFrom(averaged, fix({ satellites: 18 }), false)).toEqual({
      latitude: 5,
      longitude: 6,
      accuracy: 2.9,
      altitude: 1203.4,
      satellites: 18,
      flags: [],
    });
  });

  it("flags a draft with the raw latest fix as unverified", () => {
    expect(locationFrom(averaged, fix({ altitude: 1190 }), true)).toEqual({
      latitude: 1,
      longitude: 2,
      accuracy: 6,
      altitude: 1190,
      satellites: null,
      flags: ["gps_unverified"],
    });
  });

  it("flags mock-location fixes and needs some fix", () => {
    expect(locationFrom(averaged, fix({ mocked: true }), false)?.flags).toEqual(
      ["mock_location"],
    );
    expect(locationFrom(null, null, true)).toBeNull();
  });
});

describe("mergeDetections", () => {
  it("keeps the most confident sighting of each track across photos", () => {
    const p = (
      detections: CapturedDetection[],
      imageUri: string,
    ): CapturedPhoto => ({
      id: imageUri,
      imageUri,
      capturedAt: 0,
      heading: null,
      detections,
      quality: { sharp: null, exposureOk: null },
    });
    const merged = mergeDetections([
      p([detection(1, 0.6), detection(2, 0.9)], "a"),
      p([detection(1, 0.8)], "b"),
    ]);
    expect(merged.map((m) => [m.detection.trackId, m.photo.imageUri])).toEqual([
      [1, "b"],
      [2, "a"],
    ]);
  });
});
