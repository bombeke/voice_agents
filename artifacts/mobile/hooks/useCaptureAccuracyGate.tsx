import {
  Accuracy,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
  type LocationObject,
  type LocationSubscription,
} from "expo-location";
import { useCallback, useEffect, useState } from "react";

/**
 * Worst accuracy radius (m) a fix may report and still be good enough to tag a
 * pole with. Above this the capture button stays locked.
 */
export const MAX_CAPTURE_ACCURACY_M = 4;

/**
 * How often the watcher reports, in ms. The surveyor is standing still while they
 * frame the pole, so `distanceInterval` is left at 0 — a movement-based filter
 * would starve us of exactly the updates we need, which are the ones where the
 * fix converges without the device going anywhere.
 */
export const POSITION_SAMPLE_INTERVAL_MS = 1000;

export type CaptureGateStatus =
  | "acquiring" // waiting for the first fix
  | "denied" // location permission refused
  | "error" // watcher failed to start
  | "unknown" // platform reported no accuracy value
  | "imprecise" // accuracy radius worse than MAX_CAPTURE_ACCURACY_M
  | "ready"; // accuracy within budget — capture is enabled

export interface CaptureAccuracyGate {
  status: CaptureGateStatus;
  /** True only while the current fix is accurate to MAX_CAPTURE_ACCURACY_M or better. */
  isReady: boolean;
  /** Accuracy radius of the latest fix in metres; null before the first fix or if unreported. */
  accuracy: number | null;
  /** Most recent fix from the watcher — reuse it instead of re-querying GPS. */
  position: LocationObject | null;
  error: string | null;
}

function classify(accuracy: number | null): CaptureGateStatus {
  if (accuracy === null) return "unknown";
  return accuracy <= MAX_CAPTURE_ACCURACY_M ? "ready" : "imprecise";
}

/**
 * Streams position at the highest accuracy the device offers and gates the capture
 * button on the reported accuracy radius: a pole may only be tagged once the fix is
 * good to within MAX_CAPTURE_ACCURACY_M, so a recorded coordinate is never worse
 * than the tolerance the survey is held to.
 *
 * Note that `coords.accuracy` is a 68%-confidence radius, not a guarantee, and it
 * is `null` on platforms that do not report one (web, some emulators) — that case
 * is surfaced as "unknown" and keeps capture locked rather than silently passing.
 */
export function useCaptureAccuracyGate(enabled = true): CaptureAccuracyGate {
  const [position, setPosition] = useState<LocationObject | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<CaptureGateStatus>("acquiring");
  const [error, setError] = useState<string | null>(null);

  const applyFix = useCallback((fix: LocationObject) => {
    const radius = fix.coords.accuracy ?? null;
    setPosition(fix);
    setAccuracy(radius);
    setStatus(classify(radius));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: LocationSubscription | null = null;

    (async () => {
      try {
        const { granted } = await requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!granted) {
          setStatus("denied");
          setError("Location permission is required before capturing a pole.");
          return;
        }

        subscription = await watchPositionAsync(
          {
            accuracy: Accuracy.Highest,
            distanceInterval: 0,
            timeInterval: POSITION_SAMPLE_INTERVAL_MS,
          },
          (fix) => {
            if (cancelled) return;
            applyFix(fix);
          },
        );

        // Unmounted while watchPositionAsync was in flight.
        if (cancelled) {
          subscription.remove();
          subscription = null;
        }
      } catch (e) {
        if (cancelled) return;
        console.error("Capture accuracy gate failed:", e);
        setStatus("error");
        setError(
          e instanceof Error ? e.message : "Could not read your location.",
        );
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
    };
  }, [enabled, applyFix]);

  return {
    status,
    isReady: status === "ready",
    accuracy,
    position,
    error,
  };
}
