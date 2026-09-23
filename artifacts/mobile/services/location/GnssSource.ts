import type { GnssFix } from "@/types/Capture";
import {
  Accuracy,
  requestForegroundPermissionsAsync,
  watchHeadingAsync,
  watchPositionAsync,
  type LocationObject,
} from "expo-location";

/** Receives a GNSS stream; see useCaptureAccuracyGate. */
export interface GnssListener {
  onFix(fix: GnssFix): void;
  /** Degrees from true north (magnetic north when true north is unknown). */
  onHeading(degrees: number): void;
  onError(kind: "denied" | "error", message?: string): void;
}

export interface GnssSource {
  /** Starts streaming and resolves to a stop function. */
  start(listener: GnssListener): Promise<() => void>;
}

/** How often the watcher reports, in ms. The surveyor is standing still, so no distance filter. */
export const POSITION_SAMPLE_INTERVAL_MS = 1000;

export function toGnssFix(location: LocationObject): GnssFix {
  const { coords } = location;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: coords.altitude ?? null,
    accuracy: coords.accuracy ?? null,
    altitudeAccuracy: coords.altitudeAccuracy ?? null,
    timestamp: location.timestamp,
    mocked: location.mocked ?? false,
    // expo-location doesn't expose receiver status.
    satellites: null,
    fixType: null,
    bands: null,
  };
}

/** The device's fused location at the highest accuracy it offers (§5.1). */
export const expoLocationSource: GnssSource = {
  async start(listener) {
    const { granted } = await requestForegroundPermissionsAsync();
    if (!granted) {
      listener.onError("denied");
      return () => {};
    }
    try {
      const position = await watchPositionAsync(
        {
          accuracy: Accuracy.Highest,
          distanceInterval: 0,
          timeInterval: POSITION_SAMPLE_INTERVAL_MS,
        },
        (location) => listener.onFix(toGnssFix(location)),
      );
      // Heading is optional: devices without a compass still capture.
      const heading = await watchHeadingAsync(({ trueHeading, magHeading }) =>
        listener.onHeading(trueHeading >= 0 ? trueHeading : magHeading),
      ).catch(() => null);
      return () => {
        position.remove();
        heading?.remove();
      };
    } catch (e) {
      listener.onError("error", e instanceof Error ? e.message : undefined);
      return () => {};
    }
  },
};

let current: GnssSource = expoLocationSource;

export function getGnssSource(): GnssSource {
  return current;
}

/** Dev mocks swap in a simulated receiver (see mocks/gnss.ts). */
export function setGnssSource(source: GnssSource) {
  current = source;
}
