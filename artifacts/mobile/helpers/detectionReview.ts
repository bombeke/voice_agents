import { ATTRIBUTE_OPTIONS, CATEGORY_ATTRIBUTES } from "@/constants/Attributes";
import type { AssetCategory } from "@/constants/Colors";
import { CONFIDENCE, categoryForLabel } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import type { ScreenRect, Size } from "@/helpers/detectionGeometry";
import { fill } from "@/helpers/format";
import type {
  AttributeKey,
  CaptureCategory,
  CaptureLocation,
  ConfidenceBand,
  DetectionAttribute,
  NormalizedBox,
  ReviewDecision,
  ReviewDetection,
} from "@/types/Capture";

/** §6.3: ≥ 0.70 is pre-accepted, anything shown below that is a suggestion. */
export function initialDecision(confidence: number): ReviewDecision {
  return confidence >= CONFIDENCE.accepted ? "accepted" : "suggested";
}

/** The same §6.3 bands, applied to an attribute estimate's score. */
export function confidenceBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE.accepted) return "high";
  if (score >= CONFIDENCE.hidden) return "medium";
  return "low";
}

export function attributeKeysFor(
  category: AssetCategory | null,
): readonly AttributeKey[] {
  return CATEGORY_ATTRIBUTES[category ?? "unknown"];
}

/** Whether the surveyor can change this attribute on the device. */
export function isEditable(attribute: DetectionAttribute): boolean {
  return attribute.value !== null && ATTRIBUTE_OPTIONS[attribute.key] !== null;
}

/** "10-20" → "10–20 years"; null when the attribute has no value yet. */
export function formatAttributeValue(
  key: AttributeKey,
  value: string | null,
): string | null {
  if (value === null) return null;
  const spec = strings.attributes[key];
  if ("values" in spec) {
    return (spec.values as Record<string, string>)[value] ?? value;
  }
  return fill(spec.format, { value });
}

/** Detector labels are lower-case class names: "street_light" → "Street light". */
export function formatLabel(label: string): string {
  const text = label.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatConfidence(confidence: number): string {
  return confidence.toFixed(2);
}

/** The camera's category, or for "auto" the first kept detection's. */
export function reviewCategory(
  category: CaptureCategory,
  detections: readonly ReviewDetection[],
): AssetCategory | null {
  if (category !== "auto") return category;
  for (const d of detections) {
    if (d.decision === "rejected") continue;
    const owner = categoryForLabel(d.label);
    if (owner) return owner;
  }
  return null;
}

/** The photo holding the most detections, if any; the first one wins a tie. */
export function mostDetectedPhoto(
  detections: readonly ReviewDetection[],
): string | null {
  const counts = new Map<string, number>();
  for (const { imageUri } of detections) {
    counts.set(imageUri, (counts.get(imageUri) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [uri, count] of counts) {
    if (!best || count > counts.get(best)!) best = uri;
  }
  return best;
}

/** "wood?" on a suggestion card: the material guess, if there is one. */
export function suggestionHint(detection: ReviewDetection): string | null {
  const material = detection.attributes.find((a) => a.key === "material");
  const text = material
    ? formatAttributeValue(material.key, material.value)
    : null;
  return text ? `${text.toLowerCase()}?` : null;
}

/** Only accepted detections become records; undecided suggestions are dropped. */
export function acceptedDetections(
  detections: readonly ReviewDetection[],
): ReviewDetection[] {
  return detections.filter((d) => d.decision === "accepted");
}

/** How many AI or GIS values the surveyor changed. */
export function userEdits(detection: ReviewDetection): number {
  return detection.attributes.filter((a) => a.source === "user").length;
}

/**
 * Routes the capture to a supervisor (design-doc §3 step 10): an unverified or
 * mocked location, a suggestion the surveyor accepted (low AI confidence), or
 * heavy overrides (half or more of an asset's editable attributes changed).
 */
export function shouldFlag(
  detections: readonly ReviewDetection[],
  location: CaptureLocation | null,
): boolean {
  if (location && location.flags.length > 0) return true;
  return acceptedDetections(detections).some((d) => {
    if (d.confidence < CONFIDENCE.accepted) return true;
    const editable = d.attributes.filter(
      (a) => ATTRIBUTE_OPTIONS[a.key] !== null,
    ).length;
    return editable > 0 && userEdits(d) * 2 >= editable;
  });
}

/**
 * A box stored as fractions of the photo, placed on a view showing that photo
 * with resizeMode="contain" (letterboxed, centred).
 */
export function photoRect(
  box: NormalizedBox,
  photo: Size,
  view: Size,
): ScreenRect {
  if (photo.width <= 0 || photo.height <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(view.width / photo.width, view.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  const offsetX = (view.width - width) / 2;
  const offsetY = (view.height - height) / 2;
  return {
    left: offsetX + box.xmin * width,
    top: offsetY + box.ymin * height,
    width: (box.xmax - box.xmin) * width,
    height: (box.ymax - box.ymin) * height,
  };
}
