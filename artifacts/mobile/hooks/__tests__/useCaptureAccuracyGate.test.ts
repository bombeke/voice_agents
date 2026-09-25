import {
  expoLocationSource,
  setGnssSource,
  type GnssListener,
} from "@/services/location/GnssSource";
import type { GnssFix } from "@/types/Capture";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useCaptureAccuracyGate } from "../useCaptureAccuracyGate";

const fix = (
  accuracy: number | null,
  over: Partial<GnssFix> = {},
): GnssFix => ({
  latitude: 0.3476,
  longitude: 32.5825,
  altitude: null,
  accuracy,
  altitudeAccuracy: null,
  timestamp: Date.now(),
  mocked: false,
  satellites: 18,
  fixType: "3D",
  bands: "L1+L5",
  ...over,
});

/** A GNSS source the test drives by hand. */
function controlledSource() {
  let listener!: GnssListener;
  const stop = jest.fn();
  setGnssSource({
    start: async (l) => {
      listener = l;
      return stop;
    },
  });
  return {
    stop,
    emit: (f: GnssFix) => act(() => listener.onFix(f)),
    heading: (d: number, declination?: number | null) =>
      act(() => listener.onHeading(d, declination)),
    fail: (kind: "denied" | "error", message?: string) =>
      act(() => listener.onError(kind, message)),
    started: () => waitFor(() => expect(listener).toBeDefined()),
  };
}

afterEach(() => setGnssSource(expoLocationSource));

describe("useCaptureAccuracyGate", () => {
  it("starts acquiring and locked", async () => {
    const src = controlledSource();
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();
    expect(result.current).toMatchObject({
      status: "acquiring",
      isReady: false,
      accuracy: null,
      streak: 0,
      averaged: null,
    });
  });

  it("unlocks only after three consecutive fixes under 4 m", async () => {
    const src = controlledSource();
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();

    await src.emit(fix(6.2));
    expect(result.current).toMatchObject({
      status: "imprecise",
      accuracy: 6.2,
    });

    await src.emit(fix(3.4));
    await src.emit(fix(3.1));
    expect(result.current).toMatchObject({
      status: "confirming",
      streak: 2,
      isReady: false,
    });

    await src.emit(fix(2.8, { latitude: 0.3478 }));
    expect(result.current).toMatchObject({
      status: "ready",
      streak: 3,
      isReady: true,
    });
    expect(result.current.averaged?.accuracy).toBeCloseTo(
      (3.4 + 3.1 + 2.8) / 3,
    );
  });

  it("keeps the last known declination for the sensor compass", async () => {
    const src = controlledSource();
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();
    expect(result.current.declination).toBeNull();
    await src.heading(142, 3.14);
    expect(result.current.declination).toBe(3.1);
    await src.heading(150, null);
    expect(result.current.declination).toBe(3.1);
  });

  it("passes the compass heading through", async () => {
    const src = controlledSource();
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();
    await src.heading(142);
    expect(result.current.heading).toBe(142);
  });

  it("reports a denied permission", async () => {
    const src = controlledSource();
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();
    await src.fail("denied");
    expect(result.current).toMatchObject({ status: "denied", isReady: false });
  });

  it("does not start while disabled", async () => {
    const start = jest.fn(async () => () => {});
    setGnssSource({ start });
    await renderHook(() => useCaptureAccuracyGate(false));
    expect(start).not.toHaveBeenCalled();
  });

  it("stops the source on unmount", async () => {
    const src = controlledSource();
    const { unmount } = await renderHook(() => useCaptureAccuracyGate());
    await src.started();
    await waitFor(() => expect(src.stop).not.toHaveBeenCalled());
    await unmount();
    expect(src.stop).toHaveBeenCalled();
  });
});
