import {
  estimateDetections,
  setDetectionEstimator,
} from "@/services/capture/AttributeEstimator";
import type { CapturedDetection, CapturedPhoto } from "@/types/Capture";

const detection = (trackId: number, label: string): CapturedDetection => ({
  trackId,
  label,
  confidence: 0.55,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
});

const photo: CapturedPhoto = {
  imageUri: "/tmp/1.jpg",
  capturedAt: 0,
  heading: null,
  detections: [
    detection(1, "culvert"),
    detection(2, "culvert"),
    detection(3, "pole"),
  ],
  quality: { sharp: null, exposureOk: null },
};

const merged = [{ detection: photo.detections[0], photo }];

afterEach(() => setDetectionEstimator());

describe("estimateDetections", () => {
  it("counts on the device and leaves the rest for after sync", () => {
    const [row] = estimateDetections({
      merged,
      photos: [photo],
      category: null,
    });
    expect(row).toMatchObject({
      trackId: 1,
      imageUri: "/tmp/1.jpg",
      decision: "suggested",
    });
    // "auto" falls back to the label's category: culvert → roads.
    expect(row.attributes).toEqual([
      { key: "estimatedSize", value: null, source: "ai", confidence: null },
      { key: "vegetationCover", value: null, source: "ai", confidence: null },
      { key: "estimatedAge", value: null, source: "ai", confidence: null },
      { key: "countInFrame", value: "2", source: "ai", confidence: "medium" },
      { key: "distanceFromRoad", value: null, source: "gis", confidence: null },
    ]);
  });

  it("uses an installed estimator until it is restored", () => {
    setDetectionEstimator(() => []);
    expect(
      estimateDetections({ merged, photos: [photo], category: "roads" }),
    ).toEqual([]);
    setDetectionEstimator();
    expect(
      estimateDetections({ merged, photos: [photo], category: "roads" }),
    ).toHaveLength(1);
  });
});
