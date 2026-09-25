import type { AssetCategory } from "@/constants/Colors";
import { models, type ObjectDetectorModel } from "react-native-executorch";

/**
 * On-device asset detector (design-doc §6.1, tier 1).
 *
 * The default is the registry's YOLO26 nano at 384 px, resolved per platform
 * (XNNPACK on Android, Core ML on iOS). CI swaps in the custom model at build
 * time; both values are inlined by Metro, so they cannot change at runtime:
 *
 *   EXPO_PUBLIC_DETECTOR_MODEL_URL     https URL (or local path) of the `.pte`
 *   EXPO_PUBLIC_DETECTOR_LABELS        comma-separated class list, in output order
 *   EXPO_PUBLIC_DETECTOR_INPUT_SIZE    square input size the model was exported at
 *
 * The labels must match the model: a custom URL without labels keeps the COCO
 * list and will name every detection wrongly.
 */
const DEFAULT_MODEL = models.objectDetection.YOLO26.NANO.SIZE_384.DEFAULT;

const MODEL_URL = process.env.EXPO_PUBLIC_DETECTOR_MODEL_URL?.trim();
const LABELS = process.env.EXPO_PUBLIC_DETECTOR_LABELS?.split(",")
  .map((label) => label.trim())
  .filter(Boolean);
const INPUT_SIZE = Number(process.env.EXPO_PUBLIC_DETECTOR_INPUT_SIZE) || 384;

/** design-doc §6.3 confidence bands. */
export const CONFIDENCE = {
  /** Below this a detection is dropped. */
  hidden: 0.4,
  /** At or above this a detection is pre-accepted; between the two it is "suggested". */
  accepted: 0.7,
} as const;

export const DETECTOR_INPUT_SIZE = { width: INPUT_SIZE, height: INPUT_SIZE };

export const DETECTOR_MODEL: ObjectDetectorModel<"xyxy", string> = {
  modelPath: MODEL_URL || DEFAULT_MODEL.modelPath,
  modelOpts: {
    ...DEFAULT_MODEL.modelOpts,
    labels: LABELS?.length ? LABELS : DEFAULT_MODEL.modelOpts.labels,
    // design-doc §6.3: anything under 0.40 is never shown.
    defaultConfidenceThreshold: CONFIDENCE.hidden,
  },
};

/**
 * Short model name shown to the surveyor ("YOLO26n on device"). CI sets
 * EXPO_PUBLIC_DETECTOR_NAME with a custom model.
 */
export const DETECTOR_MODEL_NAME =
  process.env.EXPO_PUBLIC_DETECTOR_NAME?.trim() || "YOLO26n";

/** File name of the model, stored on every record it produced (§6.4). */
export const DETECTOR_MODEL_VERSION =
  DETECTOR_MODEL.modelPath.split("?")[0].split("/").pop() ?? "unknown";

/**
 * Keywords that place a detector label in a category. Matching is by substring
 * on the lower-cased label, so custom labels like "concrete_pole" still match.
 * Labels that match nothing (e.g. COCO's "person") belong to no category.
 */
const CATEGORY_KEYWORDS: Record<AssetCategory, readonly string[]> = {
  energy: [
    "pole",
    "transformer",
    "street light",
    "streetlight",
    "substation",
    "solar",
    "power line",
    "insulator",
  ],
  water: [
    "borehole",
    "tap",
    "well",
    "tank",
    "toilet",
    "latrine",
    "pump",
    "fire hydrant",
  ],
  telecom: ["mast", "tower", "antenna", "cabinet", "telecom"],
  roads: [
    "culvert",
    "bridge",
    "pothole",
    "drain",
    "traffic light",
    "stop sign",
    "road",
  ],
};

export function categoryForLabel(label: string): AssetCategory | null {
  const normalised = label.toLowerCase().replace(/[_-]/g, " ");
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => normalised.includes(k))) {
      return category as AssetCategory;
    }
  }
  return null;
}

/**
 * Labels the frame processor drops for a chosen category: those that belong to
 * a different category. Unmapped labels stay visible. Built once on the JS
 * thread as a plain object because the worklet can't call categoryForLabel
 * cheaply per detection. "auto" hides nothing.
 */
export function labelsHiddenFor(
  category: AssetCategory | "auto",
  labels: readonly string[] = DETECTOR_MODEL.modelOpts.labels,
): Record<string, true> {
  const hidden: Record<string, true> = {};
  if (category === "auto") return hidden;
  for (const label of labels) {
    const owner = categoryForLabel(label);
    if (owner && owner !== category) hidden[label] = true;
  }
  return hidden;
}
