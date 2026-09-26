import type { AssetCategory } from "@/constants/Colors";
import type {
  CaptureRecord,
  CaptureSummary,
  CaptureSyncStatus,
} from "@/types/Capture";

/** Why a record was routed to a supervisor (design-doc §3 step 10), with its evidence. */
export type ReviewReason =
  | { kind: "low_confidence"; /** 0–1 */ confidence: number }
  | { kind: "gps_unverified"; accuracyM: number }
  | { kind: "heavy_edits"; edited: number; total: number }
  | { kind: "duplicate"; distanceM: number };

export type ReviewReasonKind = ReviewReason["kind"];

/** One record waiting in the supervisor's queue. */
export interface ReviewItem {
  id: string;
  /** The capture on this device it reviews, so the card can open its record. */
  captureId?: string;
  category: AssetCategory;
  title: string;
  /** Who captured it, e.g. "Enumerator 04". */
  enumerator: string;
  /** ISO 8601 with timezone. */
  capturedAt: string;
  reason: ReviewReason;
}

export type ReviewOutcome = "approved" | "rejected";

/** Why a supervisor rejected a record. */
export type RejectReason =
  "wrong_class" | "poor_photo" | "bad_location" | "duplicate" | "other";

/** A supervisor's call, kept locally until it reaches the server. */
export interface ReviewDecision {
  itemId: string;
  captureId?: string;
  outcome: ReviewOutcome;
  rejectReason?: RejectReason;
  /** ISO 8601. */
  decidedAt: string;
  syncStatus: CaptureSyncStatus;
}

/** The last batch a supervisor downloaded to review, offline if need be. */
export interface ReviewBatch {
  id: string;
  /** ISO 8601. */
  downloadedAt: string;
  /** Items the server sent in it. */
  size: number;
}

/**
 * Another enumerator's record, downloaded for a supervisor: the row and the
 * detail screen's copy. `summary.capturedBy` says whose it is.
 */
export interface TeamRecord {
  summary: CaptureSummary;
  record: CaptureRecord;
}

/** `GET /observations/v1/review/batch`: queue items and the records they review. */
export interface ReviewBatchResponse {
  batchId: string;
  items: ReviewItem[];
  records: TeamRecord[];
}

/** Where one of the user's own records stands with the supervisor. */
export type MyReviewState = "waiting" | "approved" | "rejected";

/** `GET /observations/v1/records/mine`: the server's view of the user's routed records. */
export interface MyReviewStatus {
  captureId: string;
  state: MyReviewState;
  rejectReason?: RejectReason;
  /** ISO 8601; absent while waiting. */
  decidedAt?: string;
}
