import type { AveragedFix } from "@/helpers/accuracyGate";
import type {
  CaptureFlag,
  CaptureLocation,
  CapturedDetection,
  CapturedPhoto,
  GnssFix,
} from "@/types/Capture";

export function locationFrom(
  averaged: AveragedFix | null,
  latest: GnssFix | null,
  draft: boolean,
): CaptureLocation | null {
  const flags: CaptureFlag[] = [];
  if (latest?.mocked) flags.push("mock_location");
  const satellites = latest?.satellites ?? null;
  if (averaged && !draft) {
    const { latitude, longitude, accuracy, altitude } = averaged;
    return { latitude, longitude, accuracy, altitude, satellites, flags };
  }
  if (!latest) return null;
  return {
    latitude: latest.latitude,
    longitude: latest.longitude,
    accuracy: latest.accuracy,
    altitude: latest.altitude,
    satellites,
    flags: [...flags, "gps_unverified"],
  };
}

export interface MergedDetection {
  detection: CapturedDetection;
  photo: CapturedPhoto;
}

/**
 * The same asset seen in several photos keeps one track id; keep its most
 * confident sighting so each asset becomes one record (§3 "detections are merged").
 */
export function mergeDetections(
  photos: readonly CapturedPhoto[],
): MergedDetection[] {
  const best = new Map<number, MergedDetection>();
  for (const photo of photos) {
    for (const detection of photo.detections) {
      const seen = best.get(detection.trackId);
      if (!seen || detection.confidence > seen.detection.confidence) {
        best.set(detection.trackId, { detection, photo });
      }
    }
  }
  return [...best.values()];
}
