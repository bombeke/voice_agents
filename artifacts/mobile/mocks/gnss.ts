import type { GnssSource } from "@/services/location/GnssSource";
import type { PhotoQualityChecker } from "@/services/capture/PhotoQuality";
import type { GnssFix } from "@/types/Capture";

/**
 * Simulated GNSS receiver for `start:mock`: accuracy converges from 7.4 m to
 * 2.8 m in 0.6 m steps, as in design/ui-screens.html's camera screen, so the
 * < 4 m gate can be exercised on emulators and indoors.
 */
export const FAKE_GNSS_ORIGIN = { latitude: 0.3476, longitude: 32.5825 };
export const FAKE_HEADING = 142;
const START_ACCURACY_M = 7.4;
const BEST_ACCURACY_M = 2.8;
const STEP_M = 0.6;
const INTERVAL_MS = 700;

export function fakeFix(step: number, now: number = Date.now()): GnssFix {
  const accuracy = Math.max(BEST_ACCURACY_M, START_ACCURACY_M - step * STEP_M);
  // ~0.5 m of jitter so averaging has something to do.
  const jitter = ((step % 3) - 1) * 0.000005;
  return {
    latitude: FAKE_GNSS_ORIGIN.latitude + jitter,
    longitude: FAKE_GNSS_ORIGIN.longitude - jitter,
    altitude: 1190 + (step % 2),
    accuracy: Number(accuracy.toFixed(1)),
    altitudeAccuracy: 6,
    timestamp: now,
    mocked: false,
    satellites: accuracy < 4 ? 18 : 14,
    fixType: "3D",
    bands: "L1+L5",
  };
}

export const fakeGnssSource: GnssSource = {
  async start(listener) {
    let step = 0;
    listener.onHeading(FAKE_HEADING);
    listener.onFix(fakeFix(step));
    const timer = setInterval(
      () => listener.onFix(fakeFix(++step)),
      INTERVAL_MS,
    );
    return () => clearInterval(timer);
  },
};

export const fakePhotoQuality: PhotoQualityChecker = async () => ({
  sharp: true,
  exposureOk: true,
});
