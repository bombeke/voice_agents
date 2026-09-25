import { offsetLatLon } from "@/helpers/arGeometry";
import { mergeDetections } from "@/helpers/captureSession";
import { initialDecision } from "@/helpers/detectionReview";
import {
  baseAttributes,
  type DetectionEstimator,
} from "@/services/capture/AttributeEstimator";
import type {
  AttributeKey,
  CaptureMetadata,
  CapturedDetection,
  ConfidenceBand,
  DetectionPosition,
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

/** The mockup's ranges: distance (m), bearing (°) and height (m) per fake track. */
const FAKE_RANGES: Record<number, [number, number, number | null]> = {
  [-1]: [12.4, 142, 9.2],
  [-2]: [41.3, 118, null],
  [-3]: [18.1, 161, 7.5],
};

/** A fake AR placement around the phone's fix, as the shutter would make it. */
function fakePlacement(
  detection: CapturedDetection,
  meta: CaptureMetadata | undefined,
): Pick<CapturedDetection, "position" | "heightM"> {
  const range = FAKE_RANGES[detection.trackId];
  if (!range || !meta) return {};
  const [distanceM, bearingDeg, heightM] = range;
  const rad = (bearingDeg * Math.PI) / 180;
  const { latitude, longitude } = offsetLatLon(
    meta.device.latitude,
    meta.device.longitude,
    distanceM * Math.sin(rad),
    distanceM * Math.cos(rad),
  );
  const projectionErrorM = Math.hypot(distanceM * 0.03, distanceM * 0.087);
  const position: DetectionPosition = {
    latitude,
    longitude,
    altitude: meta.device.altitude,
    distanceM,
    slantDistanceM: Math.hypot(distanceM, 1.5),
    bearingDeg,
    accuracyM:
      meta.device.accuracy === null
        ? null
        : Math.hypot(meta.device.accuracy, projectionErrorM),
    projectionErrorM,
    source: "ar_auto",
    hitType: "ExistingPlaneUsingExtent",
    arPoint: null,
    rough: distanceM > 25,
  };
  return { position, heightM };
}

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
  const first = photos[0];
  const detections =
    merged.length > 0 || !first
      ? merged
      : mergeDetections([
          {
            ...first,
            detections: FAKE_DETECTIONS.map((d) => ({
              ...d,
              photoId: first.id,
              ...fakePlacement(d, first.metadata),
            })),
          },
        ]);

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
