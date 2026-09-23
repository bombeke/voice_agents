import { mergeDetections } from "@/helpers/captureSession";
import { initialDecision } from "@/helpers/detectionReview";
import {
  baseAttributes,
  type DetectionEstimator,
} from "@/services/capture/AttributeEstimator";
import type {
  AttributeKey,
  CapturedDetection,
  ConfidenceBand,
  ReviewDetection,
} from "@/types/Capture";

type FakeValue = [value: string, confidence: ConfidenceBand];

/**
 * Attribute estimates for `start:mock`, keyed by a detector-label keyword, so
 * the review screen shows what the tier 2 heads and cloud VLM will return.
 * Matches design/screens/Review AI detections.png.
 */
const ESTIMATES: Record<string, Partial<Record<AttributeKey, FakeValue>>> = {
  pole: {
    material: ["concrete", "high"],
    inclination: ["7", "medium"],
    estimatedAge: ["10-20", "low"],
    vegetationCover: ["partial", "high"],
  },
  light: {
    material: ["metal", "high"],
    inclination: ["0", "high"],
    estimatedAge: ["5-10", "medium"],
    vegetationCover: ["none", "high"],
  },
};

/** A distant suggestion is too small to judge well. */
const SUGGESTION: Partial<Record<AttributeKey, FakeValue>> = {
  material: ["wood", "low"],
};

/**
 * The mockup's three detections, used when the emulator's camera found
 * nothing, so the review step can still be exercised. Negative track ids
 * never clash with the tracker's.
 */
export const FAKE_DETECTIONS: CapturedDetection[] = [
  {
    trackId: -1,
    label: "pole",
    confidence: 0.91,
    box: { xmin: 0.32, ymin: 0.03, xmax: 0.63, ymax: 0.99 },
  },
  {
    trackId: -2,
    label: "pole",
    confidence: 0.64,
    box: { xmin: 0.1, ymin: 0.39, xmax: 0.19, ymax: 0.76 },
  },
  {
    trackId: -3,
    label: "street light",
    confidence: 0.83,
    box: { xmin: 0.69, ymin: 0.33, xmax: 0.85, ymax: 0.98 },
  },
];

function estimatesFor(detection: CapturedDetection) {
  const label = detection.label.toLowerCase();
  const key = Object.keys(ESTIMATES).find((k) => label.includes(k));
  const found = key ? ESTIMATES[key] : {};
  return initialDecision(detection.confidence) === "suggested"
    ? { ...found, ...SUGGESTION }
    : found;
}

export const fakeDetectionEstimator: DetectionEstimator = ({
  merged,
  photos,
  category,
}) => {
  const detections =
    merged.length > 0 || photos.length === 0
      ? merged
      : mergeDetections([{ ...photos[0], detections: FAKE_DETECTIONS }]);

  return detections.map((m): ReviewDetection => {
    const fake = estimatesFor(m.detection);
    return {
      ...m.detection,
      imageUri: m.photo.imageUri,
      decision: initialDecision(m.detection.confidence),
      attributes: baseAttributes(m, category).map((a) => {
        const estimate = fake[a.key];
        return estimate
          ? { ...a, value: estimate[0], confidence: estimate[1] }
          : a;
      }),
    };
  });
};
