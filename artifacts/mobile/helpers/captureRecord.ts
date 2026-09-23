import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import {
  acceptedDetections,
  formatLabel,
  shouldFlag,
} from "@/helpers/detectionReview";
import type { SyncedUtilityPole } from "@/services/storage/LegendState";
import type {
  CaptureFlag,
  CaptureLocation,
  CaptureSummary,
  CapturedPhoto,
  ReviewDetection,
  TagForm,
} from "@/types/Capture";

export interface RecordInput {
  photos: readonly CapturedPhoto[];
  location: CaptureLocation;
  detections: readonly ReviewDetection[];
  form: TagForm & { category: AssetCategory };
  draft: boolean;
  modelVersion: string;
  newId: () => string;
}

/** The location's flags plus a new asset saved next to a possible duplicate. */
export function recordFlags({
  location,
  form,
}: Pick<RecordInput, "location" | "form">): CaptureFlag[] {
  return form.duplicate && form.duplicateChoice === "new"
    ? [...location.flags, "duplicate_nearby"]
    : [...location.flags];
}

/**
 * One record per accepted detection (§3 "each asset becomes one record"), or
 * a single record for the photo when nothing was kept: a deliberate report.
 */
export function buildRecords(input: RecordInput): SyncedUtilityPole[] {
  const { photos, location, detections, form, draft, modelVersion, newId } =
    input;
  const first = photos[0];
  const base = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? undefined,
    altitude: location.altitude ?? undefined,
    flags: recordFlags(input),
    timestamp: first.capturedAt,
    heading: first.heading ?? undefined,
    modelVersion,
    category: form.category,
    statuses: form.statuses,
    suggestedStatuses: form.suggested,
    functional: form.functional,
    comment: form.comment.trim(),
    linkedAssetId:
      form.duplicate && form.duplicateChoice === "update"
        ? form.duplicate.id
        : undefined,
    draft,
    synced: false,
  };
  const accepted = acceptedDetections(detections);
  const records = accepted.length
    ? accepted.map(({ decision, ...detection }) => ({
        ...base,
        ...detection,
        detectionConfidence: detection.confidence,
        reviewStatus: decision,
        pid: newId(),
      }))
    : [{ ...base, imageUri: first.imageUri, pid: newId() }];
  return records as SyncedUtilityPole[];
}

/**
 * The Home row for a saved capture. Drafts, duplicates kept as new assets and
 * the review step's flags (§3 step 10) go to a supervisor.
 */
export function buildSummary(
  records: readonly SyncedUtilityPole[],
  input: Pick<
    RecordInput,
    "photos" | "location" | "detections" | "form" | "draft"
  >,
): CaptureSummary {
  const { photos, location, detections, form, draft } = input;
  const primary = acceptedDetections(detections)[0];
  return {
    id: records[0].pid!,
    category: form.category,
    title: primary
      ? formatLabel(primary.label)
      : strings.categories[form.category].label,
    capturedAt: new Date(photos[0].capturedAt).toISOString(),
    accuracyM: location.accuracy ?? 0,
    syncStatus: "pending",
    flagged:
      draft ||
      recordFlags(input).length > 0 ||
      shouldFlag(detections, location),
  };
}
