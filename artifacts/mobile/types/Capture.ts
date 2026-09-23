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
export type CaptureFlag = "gps_unverified" | "mock_location";
