import type { AssetCategory } from "@/constants/Colors";
import type { VectorClock } from "@/services/sync/ConflictResolver";
import type {
  AssetStatus,
  CaptureFlag,
  CaptureMetadata,
  CapturedDetection,
  Functional,
} from "@/types/Capture";

export type { VectorClock };

/**
 * One observation as the server syncs it (`POST /observations/v1/stream`):
 * a detected asset, or the photo itself when nothing was kept.
 */
export interface UtilityPole {
  id?: string;
  pid?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  imageUri?: string;
  detectionConfidence?: number;
  /** Single fault tag from app versions before the multi-select status list. */
  tag?: string;
  /** Condition statuses from the tagging form. */
  statuses?: AssetStatus[];
  /** The statuses the AI pre-selected; the rest were the surveyor's. */
  suggestedStatuses?: AssetStatus[];
  functional?: Functional;
  /** Free-text note from the tagging form (typed or dictated). */
  comment?: string;
  /** The existing asset this capture updates (§4.2 duplicate check). */
  linkedAssetId?: string;
  /** Saved with "Save draft": incomplete, routed to a supervisor. */
  draft?: boolean;
  /** User id (token `sub`) of the enumerator who captured it. */
  capturedBy?: string;
  category?: AssetCategory;
  /** Horizontal accuracy (m) of the averaged fix stamped on the record. */
  accuracy?: number;
  /** Metres above the WGS84 ellipsoid. */
  altitude?: number;
  /** Degrees from true north at the shutter. */
  heading?: number;
  /** Detector that produced the detection (design-doc §6.4). */
  modelVersion?: string;
  /**
   * The phone's own fix when the record sits at the asset's projected
   * position (`latitude`/`longitude` are then the asset's).
   */
  devicePosition?: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    altitude: number | null;
  };
  /** Lens, AR pose and phone fix of the photo it was detected in. */
  captureMetadata?: CaptureMetadata;
  flags?: CaptureFlag[];
  synced: boolean;
  dhis2Id?: string;
  vc: VectorClock;
}

export interface SyncMeta {
  /** ISO 8601. */
  updatedAt: string;
  deviceId: string;
  deleted?: boolean;
  syncedAt?: string;
  /** Epoch ms each field last changed (see ConflictResolver). */
  fieldUpdatedAt?: Record<string, number>;
}

export type SyncedUtilityPole = UtilityPole &
  SyncMeta &
  Partial<CapturedDetection>;

/** A pole as stored locally; records from older app versions or the server may be partial. */
export type LocalPole = Partial<SyncedUtilityPole>;
