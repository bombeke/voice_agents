import type { AssetCategory } from "@/constants/Colors";
import { CATEGORY_STATUSES } from "@/constants/Statuses";
import { strings } from "@/constants/Strings";
import {
  acceptedDetections,
  formatAttributeValue,
  formatLabel,
} from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import type { AssetStatus, ReviewDetection, TagForm } from "@/types/Capture";

export function statusesFor(
  category: AssetCategory | null,
): readonly AssetStatus[] {
  return category ? CATEGORY_STATUSES[category] : [];
}

/** Keeps the category's display order and drops what it doesn't offer. */
function inOrder(
  statuses: readonly AssetStatus[],
  category: AssetCategory | null,
): AssetStatus[] {
  return statusesFor(category).filter((s) => statuses.includes(s));
}

/** Multi-select, except that "good" and the fault statuses exclude each other. */
export function toggleStatus(
  statuses: readonly AssetStatus[],
  status: AssetStatus,
): AssetStatus[] {
  if (statuses.includes(status)) return statuses.filter((s) => s !== status);
  if (status === "good") return ["good"];
  return [...statuses.filter((s) => s !== "good"), status];
}

/**
 * The statuses after the AI's suggestions change (a new category, or going
 * back to review). The surveyor's own picks and removals survive; everything
 * else follows the new suggestions.
 */
export function mergeSuggestions(
  previous: Pick<TagForm, "statuses" | "suggested">,
  suggested: readonly AssetStatus[],
  category: AssetCategory | null,
): AssetStatus[] {
  const added = previous.statuses.filter(
    (s) => !previous.suggested.includes(s),
  );
  const removed = previous.suggested.filter(
    (s) => !previous.statuses.includes(s),
  );
  // The surveyor calling it good beats any AI fault.
  if (added.includes("good")) return inOrder(["good"], category);
  const merged = inOrder(
    [...suggested.filter((s) => !removed.includes(s)), ...added],
    category,
  );
  return merged.length > 1 ? merged.filter((s) => s !== "good") : merged;
}

/** The kept detection the record is named after. */
export function primaryDetection(
  detections: readonly ReviewDetection[],
): ReviewDetection | null {
  return acceptedDetections(detections)[0] ?? null;
}

/** "Pole · concrete · 2 detections kept" under the tagging title. */
export function tagSubtitle(detections: readonly ReviewDetection[]): string {
  const kept = acceptedDetections(detections).length;
  const count =
    kept === 0
      ? strings.capture.tag.keptNone
      : kept === 1
        ? strings.capture.tag.keptOne
        : fill(strings.capture.tag.kept, { count: kept });
  const primary = primaryDetection(detections);
  if (!primary) return count;
  const material = primary.attributes.find((a) => a.key === "material");
  const materialText = material
    ? formatAttributeValue(material.key, material.value)
    : null;
  return [formatLabel(primary.label), materialText?.toLowerCase(), count]
    .filter(Boolean)
    .join(" · ");
}

export type TagProblem = "category" | "status" | "duplicate";

/**
 * Why the form can't be saved yet, or null. A draft only needs a category;
 * a record also needs a status and, next to a possible duplicate, an answer.
 */
export function tagFormProblem(
  form: TagForm | null,
  draft: boolean,
): TagProblem | null {
  if (!form?.category) return "category";
  if (draft) return null;
  if (form.statuses.length === 0) return "status";
  if (form.duplicate && !form.duplicateChoice) return "duplicate";
  return null;
}

/** Appends dictated text to the comment as its own sentence run. */
export function appendText(comment: string, text: string): string {
  const addition = text.trim();
  if (!addition) return comment;
  const base = comment.trimEnd();
  return base ? `${base} ${addition}` : addition;
}

/** "12 Aug" in the device locale (or the one given). */
export function formatShortDate(epochMs: number, locale?: string): string {
  return new Date(epochMs).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}
