import { INCLINED_FROM_DEG } from "@/constants/Capture";
import type { AssetCategory } from "@/constants/Colors";
import { acceptedDetections } from "@/helpers/detectionReview";
import { statusesFor } from "@/helpers/tagForm";
import type { AssetStatus, ReviewDetection } from "@/types/Capture";

export interface SuggestInput {
  category: AssetCategory;
  detections: readonly ReviewDetection[];
}

export type StatusSuggester = (input: SuggestInput) => AssetStatus[];

/**
 * Statuses the kept detections' attributes point to: a lean past 5° and
 * partial or heavy vegetation. The AI never claims "good condition".
 */
const fromAttributes: StatusSuggester = ({ detections }) => {
  const found = new Set<AssetStatus>();
  for (const { attributes } of acceptedDetections(detections)) {
    for (const { key, value } of attributes) {
      if (value === null) continue;
      if (key === "inclination" && Number(value) >= INCLINED_FROM_DEG) {
        found.add("inclined");
      }
      if (key === "vegetationCover" && value !== "none") {
        found.add("vegetation");
      }
    }
  }
  return [...found];
};

let current: StatusSuggester = fromAttributes;

/** The statuses the tagging form pre-selects, limited to the category's own. */
export function suggestStatuses(input: SuggestInput): AssetStatus[] {
  const available = statusesFor(input.category);
  return current(input).filter((s) => available.includes(s));
}

/** Dev mocks or tests swap the suggester; pass nothing to restore. */
export function setStatusSuggester(
  suggester: StatusSuggester = fromAttributes,
) {
  current = suggester;
}
