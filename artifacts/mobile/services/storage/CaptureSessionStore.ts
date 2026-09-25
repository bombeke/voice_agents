import type { AssetCategory } from "@/constants/Colors";
import { tagFormFromRecord } from "@/helpers/captureRecord";
import { mergeDetections } from "@/helpers/captureSession";
import { heightOf, placeFromPixel } from "@/helpers/detectionPlacement";
import { initialDecision, reviewCategory } from "@/helpers/detectionReview";
import { findDuplicate } from "@/helpers/duplicateCheck";
import {
  appendText,
  mergeSuggestions,
  primaryDetection,
  toggleStatus as toggled,
} from "@/helpers/tagForm";
import { estimateDetections } from "@/services/capture/AttributeEstimator";
import { nearbyAssets } from "@/services/capture/NearbyAssets";
import { suggestStatuses } from "@/services/capture/StatusSuggester";
import type {
  AssetStatus,
  AttributeKey,
  CaptureCategory,
  CaptureRecord,
  CaptureLocation,
  CapturedPhoto,
  DuplicateChoice,
  Functional,
  NearbyAsset,
  ReviewDecision,
  ReviewDetection,
  TagForm,
} from "@/types/Capture";
import { observable } from "@legendapp/state";

export interface CaptureSessionState {
  category: CaptureCategory;
  photos: CapturedPhoto[];
  /** Stamped by the first shot so later ones can't drift it. */
  location: CaptureLocation | null;
  /** The review step's rows, built from the photos by `beginReview`. */
  detections: ReviewDetection[];
  /** Recorded assets around the fix, for the duplicate check. */
  nearby: NearbyAsset[];
  /** The tagging form; null until `beginTagging`. */
  tagging: TagForm | null;
  isCapturing: boolean;
  isSaving: boolean;
  /** The saved record the tagging form is editing; null for a new capture. */
  editingId: string | null;
}

const initialState = (
  category: CaptureCategory = "auto",
): CaptureSessionState => ({
  category,
  photos: [],
  location: null,
  detections: [],
  nearby: [],
  tagging: null,
  isCapturing: false,
  isSaving: false,
  editingId: null,
});

/**
 * The capture in progress, shared by the camera, review and tagging steps.
 * In memory only: nothing reaches the durable stores until the tagging form is
 * saved (useCaptureSession), and closing the camera discards it. Going back a
 * step and forward again keeps what the surveyor already decided.
 */
export const captureSession$ = observable<CaptureSessionState>(initialState());

/** A fresh session each time the camera opens. */
export function startSession(category: CaptureCategory) {
  captureSession$.set(initialState(category));
}

export function resetSession() {
  captureSession$.set(initialState(captureSession$.category.peek()));
}

/**
 * "Edit record": the tagging form filled from a saved record, with its fix
 * for the location card. There are no photos or detections to review again.
 */
export function editRecord(record: CaptureRecord) {
  captureSession$.set({
    ...initialState(record.category),
    location: record.location,
    tagging: tagFormFromRecord(record),
    editingId: record.id,
  });
}

export function addPhoto(photo: CapturedPhoto, at: CaptureLocation) {
  const { photos, location } = captureSession$.peek();
  captureSession$.assign({
    photos: [...photos, photo],
    location: location ?? at,
  });
}

export function removePhoto(index: number) {
  const photos = captureSession$.photos.peek().filter((_, i) => i !== index);
  captureSession$.photos.set(photos);
  // With every shot retaken, the next one stamps a fresh location.
  if (photos.length === 0) captureSession$.location.set(null);
}

/**
 * Builds the review rows from the photos. Going back to add a photo and
 * reviewing again keeps what the surveyor already decided or corrected.
 */
export function beginReview() {
  const { photos, category, detections: previous } = captureSession$.peek();
  const byTrack = new Map(previous.map((d) => [d.trackId, d]));
  const next = estimateDetections({
    merged: mergeDetections(photos),
    photos,
    category: category === "auto" ? null : (category as AssetCategory),
  }).map((d) => {
    const before = byTrack.get(d.trackId);
    if (!before) return d;
    const edited = new Map(
      before.attributes
        .filter((a) => a.source === "user")
        .map((a) => [a.key, a]),
    );
    return {
      ...d,
      decision: before.decision,
      attributes: d.attributes.map((a) => edited.get(a.key) ?? a),
      // A base the surveyor tapped wins over the shutter's projection.
      ...(before.positionEdited
        ? {
            position: before.position,
            heightM: before.heightM,
            positionEdited: true,
          }
        : {}),
    };
  });
  captureSession$.detections.set(next);
}

function updateDetection(
  trackId: number,
  update: (d: ReviewDetection) => ReviewDetection,
) {
  captureSession$.detections.set(
    captureSession$.detections
      .peek()
      .map((d) => (d.trackId === trackId ? update(d) : d)),
  );
}

function decide(trackId: number, decision: ReviewDecision) {
  updateDetection(trackId, (d) => ({ ...d, decision }));
}

export const acceptDetection = (trackId: number) => decide(trackId, "accepted");

export const rejectDetection = (trackId: number) => decide(trackId, "rejected");

/** Puts a rejected detection back to how the model scored it. */
export function undoRejection(trackId: number) {
  updateDetection(trackId, (d) => ({
    ...d,
    decision: initialDecision(d.confidence),
  }));
}

/** A surveyor's correction: the value becomes theirs, with no AI band. */
export function setAttribute(
  trackId: number,
  key: AttributeKey,
  value: string,
) {
  updateDetection(trackId, (d) => ({
    ...d,
    attributes: d.attributes.map((a) =>
      a.key === key ? { ...a, value, source: "user", confidence: null } : a,
    ),
  }));
}

/**
 * "Re-place by tapping the base": the surveyor tapped where the asset meets
 * the ground on the review photo (a point in that photo's pixels). The ray
 * through it meets the ground plane the AR session measured at the shutter
 * (or, without AR, flat ground below the sensor attitude). False when the
 * photo has neither pose or the ray misses the ground.
 */
export function replaceDetection(
  trackId: number,
  pixel: { x: number; y: number },
): boolean {
  const { detections, photos } = captureSession$.peek();
  const detection = detections.find((d) => d.trackId === trackId);
  const meta = photos.find((p) => p.id === detection?.photoId)?.metadata;
  if (!detection || !meta) return false;
  const position = placeFromPixel(meta, pixel, "ar_tap");
  if (!position) return false;
  const heightM = heightOf(meta, detection.box, position);
  updateDetection(trackId, (d) => ({
    ...d,
    position,
    heightM,
    positionEdited: true,
    attributes: d.attributes.map((a) =>
      a.key === "estimatedHeight"
        ? {
            ...a,
            value: heightM === null ? null : heightM.toFixed(1),
            source: position.source === "sensor" ? "sensor" : "ar",
          }
        : a,
    ),
  }));
  return true;
}

/**
 * The form for `category`: AI status suggestions and the nearest possible
 * duplicate, merged into what the surveyor already entered (if anything).
 */
function tagFormFor(
  category: AssetCategory | null,
  previous: TagForm | null,
): TagForm {
  const { detections, location, nearby } = captureSession$.peek();
  const suggested = category ? suggestStatuses({ category, detections }) : [];
  // The asset's own position when it was ranged, else the phone's.
  const at = primaryDetection(detections)?.position ?? location;
  const duplicate =
    category && at
      ? findDuplicate(
          at,
          category,
          primaryDetection(detections)?.label ?? null,
          nearby,
        )
      : null;
  if (!previous) {
    return {
      category,
      statuses: suggested,
      suggested,
      functional: "unknown",
      comment: "",
      duplicate,
      duplicateChoice: null,
    };
  }
  return {
    ...previous,
    category,
    statuses: mergeSuggestions(previous, suggested, category),
    suggested,
    duplicate,
    duplicateChoice:
      duplicate && duplicate.id === previous.duplicate?.id
        ? previous.duplicateChoice
        : null,
  };
}

/**
 * Opens (or refreshes) the tagging form from the reviewed detections.
 * `known` is the locally stored assets to check for duplicates.
 */
export function beginTagging(known: readonly NearbyAsset[] = []) {
  const { category, detections, location, tagging } = captureSession$.peek();
  captureSession$.nearby.set(location ? nearbyAssets(location, known) : []);
  captureSession$.tagging.set(
    tagFormFor(
      tagging?.category ?? reviewCategory(category, detections),
      tagging,
    ),
  );
}

function updateTagging(update: (form: TagForm) => TagForm) {
  const form = captureSession$.tagging.peek();
  if (form) captureSession$.tagging.set(update(form));
}

export function setTagCategory(category: AssetCategory) {
  updateTagging((form) =>
    form.category === category ? form : tagFormFor(category, form),
  );
}

export function toggleStatus(status: AssetStatus) {
  updateTagging((form) => ({
    ...form,
    statuses: toggled(form.statuses, status),
  }));
}

export function setFunctional(functional: Functional) {
  updateTagging((form) => ({ ...form, functional }));
}

export function setComment(comment: string) {
  updateTagging((form) => ({ ...form, comment }));
}

/** Adds dictated text after what is already typed. */
export function appendComment(text: string) {
  updateTagging((form) => ({
    ...form,
    comment: appendText(form.comment, text),
  }));
}

export function setDuplicateChoice(duplicateChoice: DuplicateChoice) {
  updateTagging((form) => ({ ...form, duplicateChoice }));
}
