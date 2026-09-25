import type { AssetCategory } from "@/constants/Colors";

export type CaptureSyncStatus = "pending" | "uploading" | "synced" | "failed";

/** What the category picker hands the camera; "auto" lets the AI choose. */
export type CaptureCategory = AssetCategory | "auto";

/** Who captured a record: the user's id (token `sub`) and display name. */
export interface Enumerator {
  id: string;
  name: string;
}

/** The slice of a capture the Home and Records screens need. */
export interface CaptureSummary {
  id: string;
  category: AssetCategory;
  /** Asset name, e.g. "Concrete pole" or "Borehole · hand pump". */
  title: string;
  /** Short tail for the meta line, e.g. "2 detections" or "partly blocked". */
  detail?: string;
  /** Code of the asset this capture updates (see MapAsset.id), once known. */
  assetId?: string;
  /** ISO 8601 with timezone. */
  capturedAt: string;
  /** Horizontal accuracy of the averaged fix, in metres. */
  accuracyM: number;
  syncStatus: CaptureSyncStatus;
  /** Routed to a supervisor (low AI confidence, heavy overrides, duplicate). */
  flagged: boolean;
  /** Absent on records saved before captures carried their owner. */
  capturedBy?: Enumerator;
}

/** A stored photo of a record; `uri` is null when the file is gone (or in mocks). */
export interface RecordPhoto {
  uri: string | null;
}

/**
 * Everything the record detail screen shows for one saved capture. Shares
 * its id with the capture's CaptureSummary; the summary keeps the sync state.
 */
export interface CaptureRecord {
  id: string;
  category: AssetCategory;
  title: string;
  /** Code of the asset this capture records (see MapAsset.id), once known. */
  assetId?: string;
  /** ISO 8601 with timezone. */
  capturedAt: string;
  photos: RecordPhoto[];
  location: CaptureLocation;
  attributes: DetectionAttribute[];
  statuses: AssetStatus[];
  /** What the AI pre-selected, so the screen knows whose the statuses are. */
  suggestedStatuses: AssetStatus[];
  functional: Functional;
  comment: string;
  /** The op-queue records (one per kept detection) an edit has to update. */
  poleIds: string[];
  capturedBy?: Enumerator;
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
  /** Id of the photo (CapturedPhoto.id) this detection was seen in. */
  photoId?: string;
  /** Where the asset itself is, projected from the photo; null when it couldn't be ranged. */
  position?: DetectionPosition | null;
  /** Height of the asset from its box and range, in metres; null when unknown. */
  heightM?: number | null;
  /** Placed by the surveyor's tap where the detector found nothing. */
  manual?: boolean;
}

/** A metric 3D vector in the AR session's frame (x right, y up, -z ahead at start). */
export type Vec3 = [number, number, number];

/** ARCore / ARKit tracking quality when a value was sampled. */
export type ArTrackingState = "normal" | "limited" | "unavailable";

/**
 * The AR camera pose from ViroReact's sensor fusion (onCameraTransformUpdate),
 * already filtered against gyro drift.
 */
export interface ArCameraPose {
  /** Metres from where the AR session started; shows how far the user drifted. */
  position: Vec3;
  /** Pitch, yaw and roll in degrees (Euler, x/y/z). */
  rotation: Vec3;
  /** Unit vector out of the lens. */
  forward: Vec3;
  /** Unit vector up the viewport; tells whether the phone was tilted. */
  up: Vec3;
  trackingState: ArTrackingState;
  /** Epoch ms of the sample. */
  timestamp: number;
}

/**
 * The camera's attitude from the phone's own sensors (gravity + magnetometer)
 * on devices without ARCore / ARKit. Same axes as the AR frame, but pinned to
 * true north: x east, y up, -z north, with the lens at the origin.
 */
export interface SensorCameraPose {
  /** Unit vector out of the lens. */
  forward: Vec3;
  /** Unit vector up the upright photo. */
  up: Vec3;
  /** Compass bearing of the lens, degrees from true north. */
  headingDeg: number;
  /** Lens pitch (+ up) and roll (+ right side down), degrees. */
  pitchDeg: number;
  rollDeg: number;
  /** False when no declination was known, so north is magnetic. */
  trueNorth: boolean;
  /** Epoch ms of the sample. */
  timestamp: number;
}

/**
 * How an asset's position was found:
 * - `ar_auto`: the AR ray through the box base hit the ground plane;
 * - `ar_tap`: the same ray, through a point the surveyor tapped;
 * - `ground_estimate`: no AR hit, so a flat-ground ray from the pose and camera height (rough);
 * - `sensor`: no AR at all; the phone's tilt and compass range it from the
 *   ground plane and the asset's typical size;
 * - `device`: nothing better, so the phone's own fix.
 */
export type PositionSource =
  "ar_auto" | "ar_tap" | "ground_estimate" | "sensor" | "device";

/** The asset's own location, projected from where the phone stood. */
export interface DetectionPosition {
  latitude: number;
  longitude: number;
  /** Metres above the WGS84 ellipsoid; null when the device reported none. */
  altitude: number | null;
  /** Horizontal distance from the phone, metres. */
  distanceM: number;
  /** Straight-line distance from the lens, metres. */
  slantDistanceM: number;
  /** Degrees from true north, phone → asset. */
  bearingDeg: number;
  /** Device fix accuracy plus the projection's own error, metres (68%). */
  accuracyM: number | null;
  /** The projection's share of `accuracyM`. */
  projectionErrorM: number;
  source: PositionSource;
  /** AR hit type (e.g. "ExistingPlaneUsingExtent", "DepthPoint"); null without a hit. */
  hitType: string | null;
  /** The hit point in the AR session frame; null without a hit. */
  arPoint: Vec3 | null;
  /** Beyond the reliable AR range: treat as a rough point. */
  rough: boolean;
}

/** Lens and image geometry of a photo. */
export interface CameraIntrinsics {
  /** Image size in pixels. */
  width: number;
  height: number;
  /** Focal length in pixels of this image; null when unknown. */
  focalLengthPx: number | null;
  /** Physical focal length in millimetres, from EXIF; null when unknown. */
  focalLengthMm: number | null;
  /** Horizontal field of view, degrees; null when unknown. */
  horizontalFovDeg: number | null;
}

/** Everything known about the phone and scene at the shutter (§6.4 provenance). */
export interface CaptureMetadata {
  /** "ar": ARCore/ARKit owned the camera; "camera": plain VisionCamera. */
  engine: "ar" | "camera";
  intrinsics: CameraIntrinsics;
  /** The phone's own fix at the shutter. */
  device: {
    latitude: number;
    longitude: number;
    /** Metres above the WGS84 ellipsoid. */
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    /** Compass heading, degrees from true north. */
    heading: number | null;
    /** Camera pitch (+ up) and roll, degrees; from AR when available. */
    pitchDeg: number | null;
    rollDeg: number | null;
  };
  /** The AR pose at the shutter; null without AR. */
  ar: ArCameraPose | null;
  /** The sensor attitude at the shutter, when there was no AR. */
  sensor?: SensorCameraPose | null;
  /** How high the lens was above the ground, metres, from the AR ground hit. */
  cameraHeightM: number | null;
  detector: {
    model: string;
    /** Last inference time, ms; null when unknown. */
    inferenceMs: number | null;
  };
}

/** Photo quality (§3 step 4); null means it wasn't checked. */
export interface PhotoQuality {
  sharp: boolean | null;
  exposureOk: boolean | null;
}

/** A shot taken on the capture screen, held in memory until the form is saved. */
export interface CapturedPhoto {
  /** Stable id; detections point at it with `photoId`. */
  id: string;
  /** Path from the camera; run it through toFileUri() before display. */
  imageUri: string;
  capturedAt: number;
  /** Degrees from true north at the shutter; null without a compass reading. */
  heading: number | null;
  detections: CapturedDetection[];
  quality: PhotoQuality;
  /** Absent on photos from before capture metadata was recorded. */
  metadata?: CaptureMetadata;
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
  | "estimatedHeight"
  | "vegetationCover"
  | "countInFrame"
  | "distanceFromRoad";

/**
 * Who set an attribute: the model, AR ranging, sensor ranging (no AR), a GIS
 * computation, or the surveyor.
 */
export type AttributeSource = "ai" | "ar" | "sensor" | "gis" | "user";

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
  /** The surveyor re-placed it by tapping its base on the review photo. */
  positionEdited?: boolean;
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
