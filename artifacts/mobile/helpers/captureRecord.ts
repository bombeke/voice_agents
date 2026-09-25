import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import {
  acceptedDetections,
  formatLabel,
  shouldFlag,
} from "@/helpers/detectionReview";
import type { SyncedUtilityPole } from "@/services/storage/LegendState";
import type {
  CaptureFlag,
  CaptureLocation,
  CaptureRecord,
  CaptureSummary,
  CapturedPhoto,
  DetectionPosition,
  Enumerator,
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
  /** The signed-in user; the server scopes records by it. */
  capturedBy?: Enumerator;
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

/** The phone's own fix, kept on a record placed at the asset's position. */
function devicePositionOf(location: CaptureLocation) {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    altitude: location.altitude,
  };
}

/**
 * A ranged asset's record takes the asset's position, not the phone's
 * ("the record takes its position, not yours"). Unranged ones keep the fix.
 */
function assetLocation(position: DetectionPosition | null | undefined) {
  if (!position || position.source === "device") return {};
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    ...(position.accuracyM === null ? {} : { accuracy: position.accuracyM }),
    ...(position.altitude === null ? {} : { altitude: position.altitude }),
  };
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
    capturedBy: input.capturedBy?.id,
    synced: false,
  };
  const metadataOf = (photoId?: string) =>
    photos.find((p) => p.id === photoId)?.metadata;
  const accepted = acceptedDetections(detections);
  const records = accepted.length
    ? accepted.map(({ decision, positionEdited, ...detection }) => ({
        ...base,
        ...detection,
        ...assetLocation(detection.position),
        devicePosition: devicePositionOf(location),
        captureMetadata: metadataOf(detection.photoId),
        detectionConfidence: detection.confidence,
        reviewStatus: decision,
        pid: newId(),
      }))
    : [
        {
          ...base,
          imageUri: first.imageUri,
          photoId: first.id,
          captureMetadata: first.metadata,
          pid: newId(),
        },
      ];
  return records as SyncedUtilityPole[];
}

/** "3 detections", else the first problem status, else whether it works. */
export function summaryDetail(
  detections: number,
  form: Pick<TagForm, "statuses" | "functional">,
): string | undefined {
  if (detections > 1) {
    return fill(strings.records.detections, { count: detections });
  }
  const problem = form.statuses.find((status) => status !== "good");
  if (problem) return strings.capture.statuses[problem];
  return form.functional === "unknown"
    ? undefined
    : strings.records.functional[form.functional];
}

/**
 * The Home and Records row for a saved capture. Drafts, duplicates kept as new assets and
 * the review step's flags (§3 step 10) go to a supervisor.
 */
export function buildSummary(
  records: readonly SyncedUtilityPole[],
  input: Pick<
    RecordInput,
    "photos" | "location" | "detections" | "form" | "draft" | "capturedBy"
  >,
): CaptureSummary {
  const { photos, location, detections, form, draft, capturedBy } = input;
  const accepted = acceptedDetections(detections);
  const primary = accepted[0];
  const assetId =
    form.duplicate && form.duplicateChoice === "update"
      ? form.duplicate.id
      : undefined;
  return {
    id: records[0].pid!,
    category: form.category,
    title: primary
      ? formatLabel(primary.label)
      : strings.categories[form.category].label,
    detail: summaryDetail(accepted.length, form),
    ...(assetId ? { assetId } : {}),
    capturedAt: new Date(photos[0].capturedAt).toISOString(),
    accuracyM: location.accuracy ?? 0,
    syncStatus: "pending",
    flagged:
      draft ||
      recordFlags(input).length > 0 ||
      shouldFlag(detections, location),
    ...(capturedBy ? { capturedBy } : {}),
  };
}

/**
 * The record detail screen's copy of a saved capture. `photoUris` are the
 * photos as stored (see ImageStore), in the order they were taken.
 */
export function buildRecord(
  summary: CaptureSummary,
  records: readonly SyncedUtilityPole[],
  input: Pick<RecordInput, "location" | "detections" | "form">,
  photoUris: readonly string[],
): CaptureRecord {
  const { location, detections, form } = input;
  const primary = acceptedDetections(detections)[0];
  return {
    id: summary.id,
    category: summary.category,
    title: summary.title,
    ...(summary.assetId ? { assetId: summary.assetId } : {}),
    capturedAt: summary.capturedAt,
    photos: photoUris.map((uri) => ({ uri })),
    location: { ...location, flags: recordFlags(input) },
    attributes: primary?.attributes ?? [],
    statuses: [...form.statuses],
    suggestedStatuses: [...form.suggested],
    functional: form.functional,
    comment: form.comment.trim(),
    poleIds: records.map((r) => r.pid!),
    ...(summary.capturedBy ? { capturedBy: summary.capturedBy } : {}),
  };
}

/** The tagging form a saved record opens with for "Edit record". */
export function tagFormFromRecord(record: CaptureRecord): TagForm {
  return {
    category: record.category,
    statuses: [...record.statuses],
    suggested: [...record.suggestedStatuses],
    functional: record.functional,
    comment: record.comment,
    // The duplicate question was answered when the record was saved.
    duplicate: null,
    duplicateChoice: null,
  };
}

/**
 * An edited record, its list row (back to pending, as it has to upload
 * again) and the changed fields for its queued records.
 */
export function applyTagEdit(
  record: CaptureRecord,
  summary: CaptureSummary,
  form: TagForm & { category: AssetCategory },
) {
  const fields = {
    category: form.category,
    statuses: [...form.statuses],
    suggestedStatuses: [...form.suggested],
    functional: form.functional,
    comment: form.comment.trim(),
  };
  return {
    record: { ...record, ...fields },
    summary: {
      ...summary,
      category: form.category,
      detail: summaryDetail(record.poleIds.length, form),
      syncStatus: "pending" as const,
    },
    poleFields: fields,
  };
}
