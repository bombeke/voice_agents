import type { AssetCategory } from "@/constants/Colors";

export type CaptureSyncStatus = "pending" | "uploading" | "synced" | "failed";

/** What the category picker hands the camera; "auto" lets the AI choose. */
export type CaptureCategory = AssetCategory | "auto";

/** The slice of a capture the Home and Records screens need. */
export interface CaptureSummary {
  id: string;
  category: AssetCategory;
  /** Asset class plus the headline attribute, e.g. "Concrete pole · inclined 7°". */
  title: string;
  /** ISO 8601 with timezone. */
  capturedAt: string;
  /** Horizontal accuracy of the averaged fix, in metres. */
  accuracyM: number;
  syncStatus: CaptureSyncStatus;
  /** Routed to a supervisor (low AI confidence, heavy overrides, duplicate). */
  flagged: boolean;
}

export interface GnssStatus {
  /** Frequency bands in use, e.g. "L1+L5". */
  bands: string;
  ok: boolean;
}

/** One GNSS reading, from expo-location or the dev GNSS simulator. */
export interface GnssFix {
  latitude: number;
  longitude: number;
  /** Metres above the WGS84 ellipsoid; null when not reported. */
  altitude: number | null;
  /** Horizontal 68% radius in metres; null when the platform reports none. */
  accuracy: number | null;
  altitudeAccuracy: number | null;
  /** Epoch ms of the fix. */
  timestamp: number;
  /** Android reports fixes from mock-location providers. */
  mocked: boolean;
  /** Receiver detail expo-location does not expose; null on real devices for now. */
  satellites: number | null;
  fixType: "2D" | "3D" | null;
  bands: string | null;
}

/** Bounding box as fractions (0–1) of the camera frame, so it maps onto any photo size. */
export interface NormalizedBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/** A tracked live detection frozen at the shutter. */
export interface CapturedDetection {
  trackId: number;
  label: string;
  confidence: number;
  box: NormalizedBox;
}

/** Photo quality (§3 step 4); null means it wasn't checked. */
export interface PhotoQuality {
  sharp: boolean | null;
  exposureOk: boolean | null;
}

/** A shot taken on the capture screen, held in memory until the form is saved. */
export interface CapturedPhoto {
  /** Path from the camera; run it through toFileUri() before display. */
  imageUri: string;
  capturedAt: number;
  /** Degrees from true north at the shutter; null without a compass reading. */
  heading: number | null;
  detections: CapturedDetection[];
  quality: PhotoQuality;
}

/** Quality flags from design-doc §5.4 that the capture screen can raise. */
export type CaptureFlag =
  | "gps_unverified"
  | "mock_location"
  /** Saved as a new asset although one of its class is within 5 m. */
  | "duplicate_nearby";

/** Where the shots were located: the gate's averaged fix, or a draft's raw one. */
export interface CaptureLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Metres above the WGS84 ellipsoid; null when not reported. */
  altitude: number | null;
  /** Satellites in the fix; null when the receiver doesn't report them. */
  satellites: number | null;
  flags: CaptureFlag[];
}

/** Attributes the detection review shows per asset (design-doc §6.2). */
export type AttributeKey =
  | "material"
  | "inclination"
  | "estimatedAge"
  | "estimatedSize"
  | "vegetationCover"
  | "countInFrame"
  | "distanceFromRoad";

/** Who set an attribute: the model, a GIS computation, or the surveyor. */
export type AttributeSource = "ai" | "gis" | "user";

export type ConfidenceBand = "high" | "medium" | "low";

export interface DetectionAttribute {
  key: AttributeKey;
  /** Option code (see constants/Attributes.ts); null until it is estimated. */
  value: string | null;
  source: AttributeSource;
  /** Only AI values carry a band. */
  confidence: ConfidenceBand | null;
}

/**
 * §6.3: pre-accepted (≥ 0.70), suggested (0.40–0.70, needs a tap), or
 * rejected by the surveyor as "not an asset".
 */
export type ReviewDecision = "accepted" | "suggested" | "rejected";

/** One merged detection on the review screen (capture step 2 of 3). */
export interface ReviewDetection extends CapturedDetection {
  /** The photo its most confident sighting came from. */
  imageUri: string;
  decision: ReviewDecision;
  attributes: DetectionAttribute[];
}

/** Condition chips on the tagging form (see constants/Statuses.ts). */
export type AssetStatus =
  | "good"
  | "inclined"
  | "vegetation"
  | "cracked"
  | "rust"
  | "sagging_lines"
  | "under_construction"
  | "leaking"
  | "blocked"
  | "eroded"
  | "potholes"
  | "vandalised";

/** §2.5: the AI can't judge this from a photo, so it starts as "unknown". */
export type Functional = "yes" | "no" | "unknown";

/** An asset already recorded, checked against a new capture for duplicates. */
export interface NearbyAsset {
  /** Asset code, e.g. "EP-00412". */
  id: string;
  category: AssetCategory;
  /** Detector class, e.g. "pole"; null when the record has none. */
  label: string | null;
  latitude: number;
  longitude: number;
  /** Epoch ms. */
  capturedAt: number;
}

export interface DuplicateCandidate extends NearbyAsset {
  distanceM: number;
}

/** Update the nearby asset, or record this one as a new asset. */
export type DuplicateChoice = "update" | "new";

/** The tagging form (capture step 3 of 3). */
export interface TagForm {
  category: AssetCategory | null;
  statuses: AssetStatus[];
  /** What the AI pre-selected, so the record knows which statuses were the user's. */
  suggested: AssetStatus[];
  functional: Functional;
  comment: string;
  duplicate: DuplicateCandidate | null;
  duplicateChoice: DuplicateChoice | null;
}
