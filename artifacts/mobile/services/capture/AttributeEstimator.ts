import type { AssetCategory } from "@/constants/Colors";
import { categoryForLabel } from "@/constants/DetectorModel";
import type { MergedDetection } from "@/helpers/captureSession";
import {
  attributeKeysFor,
  confidenceBand,
  initialDecision,
} from "@/helpers/detectionReview";
import type {
  CapturedPhoto,
  DetectionAttribute,
  ReviewDetection,
} from "@/types/Capture";

export interface EstimateInput {
  merged: readonly MergedDetection[];
  photos: readonly CapturedPhoto[];
  /** The camera's category; null when the AI picks. */
  category: AssetCategory | null;
}

export type DetectionEstimator = (input: EstimateInput) => ReviewDetection[];

/**
 * The attribute rows for one detection. Only the count is known on the device
 * today; the tier 2 heads and the cloud VLM (design-doc §6.1) fill the rest
 * after sync, and the distance from the main road is a GIS computation.
 */
export function baseAttributes(
  { detection, photo }: MergedDetection,
  category: AssetCategory | null,
): DetectionAttribute[] {
  const keys = attributeKeysFor(category ?? categoryForLabel(detection.label));
  return keys.map((key): DetectionAttribute => {
    if (key === "distanceFromRoad") {
      return { key, value: null, source: "gis", confidence: null };
    }
    if (key === "countInFrame") {
      const count = photo.detections.filter(
        (d) => d.label === detection.label,
      ).length;
      return {
        key,
        value: String(Math.max(1, count)),
        source: "ai",
        confidence: confidenceBand(detection.confidence),
      };
    }
    return { key, value: null, source: "ai", confidence: null };
  });
}

const onDevice: DetectionEstimator = ({ merged, category }) =>
  merged.map((m) => ({
    ...m.detection,
    imageUri: m.photo.imageUri,
    decision: initialDecision(m.detection.confidence),
    attributes: baseAttributes(m, category),
  }));

let current: DetectionEstimator = onDevice;

/** Turns the merged detections into the rows the review screen shows. */
export function estimateDetections(input: EstimateInput): ReviewDetection[] {
  return current(input);
}

/** Dev mocks swap in fake attribute estimates; pass nothing to restore. */
export function setDetectionEstimator(
  estimator: DetectionEstimator = onDevice,
) {
  current = estimator;
}
