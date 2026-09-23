import type { AssetCategory } from "@/constants/Colors";
import type { AssetStatus } from "@/types/Capture";

/**
 * Status chips on the tagging form per category, in display order
 * (design/screens/Tagging form.png for energy, design-doc §2 for the rest).
 * "good" is always first and can't be combined with the others.
 */
export const CATEGORY_STATUSES: Record<AssetCategory, readonly AssetStatus[]> =
  {
    energy: [
      "good",
      "inclined",
      "vegetation",
      "cracked",
      "rust",
      "sagging_lines",
      "under_construction",
    ],
    water: [
      "good",
      "leaking",
      "cracked",
      "rust",
      "blocked",
      "vegetation",
      "under_construction",
    ],
    telecom: [
      "good",
      "inclined",
      "vegetation",
      "cracked",
      "rust",
      "vandalised",
      "under_construction",
    ],
    roads: [
      "good",
      "potholes",
      "cracked",
      "eroded",
      "blocked",
      "vegetation",
      "under_construction",
    ],
  };

export const FUNCTIONAL_OPTIONS = ["yes", "no", "unknown"] as const;
