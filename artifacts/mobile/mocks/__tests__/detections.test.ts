import type { CapturedPhoto } from "@/types/Capture";
import { fakeDetectionEstimator } from "../detections";

const photo = (detections: CapturedPhoto["detections"]): CapturedPhoto => ({
  imageUri: "/tmp/1.jpg",
  capturedAt: 0,
  heading: null,
  detections,
  quality: { sharp: null, exposureOk: null },
});

describe("fakeDetectionEstimator", () => {
  it("shows the mockup's detections when the camera found none", () => {
    const rows = fakeDetectionEstimator({
      merged: [],
      photos: [photo([])],
      category: "energy",
    });
    expect(rows.map((r) => [r.label, r.confidence, r.decision])).toEqual([
      ["pole", 0.91, "accepted"],
      ["pole", 0.64, "suggested"],
      ["street light", 0.83, "accepted"],
    ]);
    expect(rows[0].attributes).toEqual(
      expect.arrayContaining([
        {
          key: "material",
          value: "concrete",
          source: "ai",
          confidence: "high",
        },
        {
          key: "estimatedAge",
          value: "10-20",
          source: "ai",
          confidence: "low",
        },
      ]),
    );
    expect(rows[1].attributes).toEqual(
      expect.arrayContaining([
        { key: "material", value: "wood", source: "ai", confidence: "low" },
      ]),
    );
  });

  it("fills in real detections and never invents photos", () => {
    const real = photo([
      {
        trackId: 4,
        label: "pole",
        confidence: 0.8,
        box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
      },
    ]);
    const rows = fakeDetectionEstimator({
      merged: [{ detection: real.detections[0], photo: real }],
      photos: [real],
      category: "energy",
    });
    expect(rows.map((r) => r.trackId)).toEqual([4]);
    expect(
      fakeDetectionEstimator({ merged: [], photos: [], category: null }),
    ).toEqual([]);
  });
});
