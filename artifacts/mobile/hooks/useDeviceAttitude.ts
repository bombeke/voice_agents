import {
  cameraPoseFromSensors,
  type SensorReading,
} from "@/helpers/sensorGeometry";
import type { SensorCameraPose, Vec3 } from "@/types/Capture";
import { Accelerometer, Magnetometer } from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/** Sensor update period, ms. */
export const ATTITUDE_INTERVAL_MS = 50;
/** Low-pass weight of each new sample (~0.3 s time constant at 20 Hz). */
const SMOOTHING = 0.15;
/**
 * The accelerometer reports the reaction to gravity (+z face up) on Android
 * and gravity itself (−z face up) on iOS; the geometry wants gravity.
 */
const GRAVITY_SIGN = Platform.OS === "android" ? -1 : 1;

export type AttitudeStatus = "starting" | "ready" | "unavailable";

export interface DeviceAttitude {
  status: AttitudeStatus;
  /** The smoothed lens pose now; null until both sensors have reported. */
  read: () => SensorCameraPose | null;
}

function smooth(prev: Vec3 | null, next: Vec3): Vec3 {
  if (!prev) return next;
  return [
    prev[0] + (next[0] - prev[0]) * SMOOTHING,
    prev[1] + (next[1] - prev[1]) * SMOOTHING,
    prev[2] + (next[2] - prev[2]) * SMOOTHING,
  ];
}

/**
 * The camera's attitude from the accelerometer and magnetometer, for ranging
 * on devices without ARCore / ARKit (see sensorGeometry). The samples arrive
 * at 20 Hz, so they are kept in refs; callers read the pose when they need it.
 * `declinationDeg` (from the compass) turns magnetic north into true north.
 */
export function useDeviceAttitude(
  enabled: boolean,
  declinationDeg: number | null,
): DeviceAttitude {
  const [status, setStatus] = useState<AttitudeStatus>("starting");
  const gravity = useRef<Vec3 | null>(null);
  const magnetic = useRef<Vec3 | null>(null);
  const stamp = useRef(0);
  const declination = useRef(declinationDeg);
  declination.current = declinationDeg;

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let live = true;
    const subs: { remove: () => void }[] = [];
    (async () => {
      const [hasAccel, hasMag] = await Promise.all([
        Accelerometer.isAvailableAsync().catch(() => false),
        Magnetometer.isAvailableAsync().catch(() => false),
      ]);
      if (!live) return;
      if (!hasAccel || !hasMag) {
        setStatus("unavailable");
        return;
      }
      Accelerometer.setUpdateInterval(ATTITUDE_INTERVAL_MS);
      Magnetometer.setUpdateInterval(ATTITUDE_INTERVAL_MS);
      subs.push(
        Accelerometer.addListener(({ x, y, z }) => {
          gravity.current = smooth(gravity.current, [
            GRAVITY_SIGN * x,
            GRAVITY_SIGN * y,
            GRAVITY_SIGN * z,
          ]);
          stamp.current = Date.now();
        }),
        Magnetometer.addListener(({ x, y, z }) => {
          magnetic.current = smooth(magnetic.current, [x, y, z]);
        }),
      );
      setStatus("ready");
    })();
    return () => {
      live = false;
      subs.forEach((s) => s.remove());
      gravity.current = null;
      magnetic.current = null;
    };
  }, [enabled]);

  const read = useCallback((): SensorCameraPose | null => {
    if (!gravity.current || !magnetic.current) return null;
    const reading: SensorReading = {
      gravity: gravity.current,
      magnetic: magnetic.current,
      declinationDeg: declination.current,
      timestamp: stamp.current,
    };
    return cameraPoseFromSensors(reading);
  }, []);

  return { status, read };
}
