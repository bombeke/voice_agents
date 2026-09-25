import { SENSOR_RANGE_INTERVAL_MS } from "@/constants/Capture";
import type { DeviceAttitude } from "@/hooks/useDeviceAttitude";
import type {
  CaptureLocation,
  CapturedDetection,
  SensorCameraPose,
} from "@/types/Capture";
import { act, renderHook } from "@testing-library/react-native";
import { useSensorRanging } from "../useSensorRanging";

const POSE: SensorCameraPose = {
  forward: [0, 0, -1],
  up: [0, 1, 0],
  headingDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  trueNorth: true,
  timestamp: 1,
};

const LOCATION: CaptureLocation = {
  latitude: 0.3136,
  longitude: 32.5811,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

/** Base 150 px under the centre of a 1000 × 2000 frame at f = 1000 px: 10 m. */
const culvert: CapturedDetection = {
  trackId: 7,
  label: "culvert",
  confidence: 0.8,
  box: { xmin: 0.45, xmax: 0.55, ymin: 0.5, ymax: (0.575 - 0.01) / 0.98 },
};

// 35 mm equivalent that gives f = 1000 px on the 1000 × 2000 frame.
const FOCAL_35 = (1000 * Math.hypot(36, 24)) / Math.hypot(1000, 2000);

const attitude = (pose: SensorCameraPose | null): DeviceAttitude => ({
  status: "ready",
  read: () => pose,
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function tick() {
  await act(() => jest.advanceTimersByTime(SENSOR_RANGE_INTERVAL_MS));
}

describe("useSensorRanging", () => {
  it("ranges the most confident track from the attitude", async () => {
    const weak = { ...culvert, trackId: 8, confidence: 0.5 };
    const { result } = await renderHook(() =>
      useSensorRanging({
        enabled: true,
        attitude: attitude(POSE),
        snapshot: () => [weak, culvert],
        frameSize: { width: 1000, height: 2000 },
        focal35mm: FOCAL_35,
        location: LOCATION,
      }),
    );
    expect(result.current).toBeNull();
    await tick();
    expect(result.current).toMatchObject({
      trackId: 7,
      label: "culvert",
      position: { source: "sensor", distanceM: expect.closeTo(10, 3) },
    });
  });

  it("has no target without an attitude, a fix or the lens", async () => {
    const run = async (over: object) => {
      const { result } = await renderHook(() =>
        useSensorRanging({
          enabled: true,
          attitude: attitude(POSE),
          snapshot: () => [culvert],
          frameSize: { width: 1000, height: 2000 },
          focal35mm: FOCAL_35,
          location: LOCATION,
          ...over,
        }),
      );
      await tick();
      return result.current;
    };
    expect(await run({ attitude: attitude(null) })).toBeNull();
    expect(await run({ location: null })).toBeNull();
    expect(await run({ focal35mm: null })).toBeNull();
    expect(await run({ enabled: false })).toBeNull();
  });

  it("drops the target when the track goes", async () => {
    let tracks = [culvert];
    const { result } = await renderHook(() =>
      useSensorRanging({
        enabled: true,
        attitude: attitude(POSE),
        snapshot: () => tracks,
        frameSize: { width: 1000, height: 2000 },
        focal35mm: FOCAL_35,
        location: LOCATION,
      }),
    );
    await tick();
    expect(result.current).not.toBeNull();
    tracks = [];
    await tick();
    expect(result.current).toBeNull();
  });
});
