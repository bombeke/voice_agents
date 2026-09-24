import type { AssetCategory } from "@/constants/Colors";
import type { CaptureSyncStatus } from "@/types/Capture";

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
