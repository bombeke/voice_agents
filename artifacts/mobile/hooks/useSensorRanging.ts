import { SENSOR_RANGE_INTERVAL_MS } from "@/constants/Capture";
import { CONFIDENCE } from "@/constants/DetectorModel";
import { focalPxFrom35mm } from "@/helpers/captureMetadata";
import type { Size } from "@/helpers/detectionGeometry";
import { placeWithSensors } from "@/helpers/sensorGeometry";
import type { DeviceAttitude } from "@/hooks/useDeviceAttitude";
import type {
  CaptureLocation,
  CapturedDetection,
  DetectionPosition,
} from "@/types/Capture";
import { useEffect, useRef, useState } from "react";

/** The asset the sensors are ranging: the most confident track. */
export interface SensorTarget {
  trackId: number;
  label: string;
  position: DetectionPosition;
}

export interface SensorRangingInput {
  enabled: boolean;
  attitude: DeviceAttitude;
  /** Current tracks as fractions of the frame. */
  snapshot: () => CapturedDetection[];
  /** Upright camera frame size; null before the first frame. */
  frameSize: Size | null;
  /** The camera's 35 mm-equivalent focal length; null when unknown. */
  focal35mm: number | null;
  location: CaptureLocation | null;
}

/** Positions change by millimetres every tick; only re-render on a visible change. */
function sameTarget(a: SensorTarget | null, b: SensorTarget | null) {
  if (!a || !b) return a === b;
  return (
    a.trackId === b.trackId &&
    a.label === b.label &&
    Math.abs(a.position.distanceM - b.position.distanceM) < 0.05 &&
    Math.abs(a.position.bearingDeg - b.position.bearingDeg) < 0.5 &&
    a.position.rough === b.position.rough &&
    a.position.accuracyM?.toFixed(1) === b.position.accuracyM?.toFixed(1)
  );
}

/**
 * Live range and position of the best track on devices without AR, from the
 * sensor attitude, every SENSOR_RANGE_INTERVAL_MS. The shutter ranges every
 * detection again on the full photo (CameraShot); this is the preview.
 */
export function useSensorRanging({
  enabled,
  attitude,
  snapshot,
  frameSize,
  focal35mm,
  location,
}: SensorRangingInput): SensorTarget | null {
  const [target, setTarget] = useState<SensorTarget | null>(null);
  const current = useRef<SensorTarget | null>(null);
  // The fix and the tracks change between ticks; the timer reads the latest.
  const latest = useRef({ snapshot, location });
  latest.current = { snapshot, location };
  const { read } = attitude;

  useEffect(() => {
    const focalLengthPx = frameSize
      ? focalPxFrom35mm(focal35mm, frameSize)
      : null;
    const clear = () => {
      if (current.current) {
        current.current = null;
        setTarget(null);
      }
    };
    if (!enabled || !frameSize || !focalLengthPx) {
      clear();
      return;
    }
    const intrinsics = { ...frameSize, focalLengthPx };
    const timer = setInterval(() => {
      const { location } = latest.current;
      const pose = read();
      if (!location || !pose) {
        clear();
        return;
      }
      const device = {
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy,
        altitudeAccuracy: null,
        heading: pose.headingDeg,
        pitchDeg: pose.pitchDeg,
        rollDeg: pose.rollDeg,
      };
      const best = latest.current
        .snapshot()
        .filter((d) => d.confidence >= CONFIDENCE.hidden)
        .sort((a, b) => b.confidence - a.confidence)[0];
      const placed = best
        ? placeWithSensors({
            device,
            pose,
            intrinsics,
            box: best.box,
            label: best.label,
          })
        : null;
      const next =
        best && placed
          ? {
              trackId: best.trackId,
              label: best.label,
              position: placed.position,
            }
          : null;
      if (!sameTarget(current.current, next)) {
        current.current = next;
        setTarget(next);
      }
    }, SENSOR_RANGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, read, frameSize, focal35mm]);

  return target;
}
