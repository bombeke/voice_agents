import type { AssetCategory } from "@/constants/Colors";
import type {
  AssetStatus,
  CaptureSyncStatus,
  DetectionAttribute,
  Functional,
} from "@/types/Capture";

/** A recorded asset as the Map tab shows it: a pin plus its asset profile. */
export interface MapAsset {
  /** Asset code, e.g. "EP-00412". */
  id: string;
  category: AssetCategory;
  /** Detector class, e.g. "pole". */
  label: string;
  /** Display name, e.g. "Concrete pole". */
  title: string;
  latitude: number;
  longitude: number;
  /** Horizontal accuracy of the fix, in metres. */
  accuracyM: number;
  /** Metres above the WGS84 ellipsoid; null when not reported. */
  altitude: number | null;
  statuses: AssetStatus[];
  functional: Functional;
  attributes: DetectionAttribute[];
  /** Epoch ms of the first capture. */
  firstRecordedAt: number;
  /** Epoch ms of the latest capture or inspection. */
  lastSeenAt: number;
  /** Name of the surveyor behind the latest capture. */
  capturedBy: string;
  photoCount: number;
  syncStatus: CaptureSyncStatus;
  /** Routed to a supervisor (low AI confidence, heavy overrides, duplicate). */
  flagged: boolean;
  comment: string;
}

export type MapCategoryFilter = AssetCategory | "all";

export type Basemap = "streets" | "light" | "satellite";

export interface MapPreferences {
  basemap: Basemap;
  /** Group nearby pins into numbered clusters. */
  cluster: boolean;
}
