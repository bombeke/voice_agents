import type { AssetCategory } from "@/constants/Colors";
import type { AttributeKey } from "@/types/Capture";

/**
 * Attributes reviewed per category (design-doc §6.2), in display order. An
 * unresolved "auto" capture gets the ones every asset has.
 */
export const CATEGORY_ATTRIBUTES: Record<
  AssetCategory | "unknown",
  readonly AttributeKey[]
> = {
  energy: [
    "material",
    "inclination",
    "estimatedAge",
    "vegetationCover",
    "countInFrame",
    "distanceFromRoad",
  ],
  water: [
    "material",
    "estimatedSize",
    "estimatedAge",
    "countInFrame",
    "distanceFromRoad",
  ],
  telecom: [
    "material",
    "inclination",
    "estimatedAge",
    "vegetationCover",
    "countInFrame",
    "distanceFromRoad",
  ],
  roads: [
    "estimatedSize",
    "vegetationCover",
    "estimatedAge",
    "countInFrame",
    "distanceFromRoad",
  ],
  unknown: ["estimatedAge", "countInFrame", "distanceFromRoad"],
};

/**
 * Values the surveyor can pick when correcting an attribute. Codes are stored
 * on the record; labels come from `strings.attributes`. `null` means the
 * attribute isn't edited on the device (GIS computes it after sync).
 */
export const ATTRIBUTE_OPTIONS: Record<AttributeKey, readonly string[] | null> =
  {
    material: ["concrete", "metal", "wood"],
    inclination: ["0", "5", "10", "15", "20", "30", "45"],
    estimatedAge: ["0-5", "5-10", "10-20", "20+"],
    estimatedSize: ["small", "medium", "large"],
    vegetationCover: ["none", "partial", "heavy"],
    countInFrame: ["1", "2", "3", "4", "5"],
    distanceFromRoad: null,
  };
