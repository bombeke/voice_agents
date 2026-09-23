import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { useCaptureAccuracyGate } from "../useCaptureAccuracyGate";

jest.mock("expo-location", () => ({
  Accuracy: { Highest: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const requestPermission = jest.mocked(
  Location.requestForegroundPermissionsAsync,
);
const watchPosition = jest.mocked(Location.watchPositionAsync);

const fix = (accuracy: number | null) =>
  ({
    timestamp: Date.now(),
    coords: {
      latitude: 0.3476,
      longitude: 32.5825,
      altitude: null,
      accuracy,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  }) as Location.LocationObject;

/** Starts the hook and returns a function that pushes GPS fixes into it. */
async function startGate() {
  let push!: (f: Location.LocationObject) => void;
  const remove = jest.fn();
  watchPosition.mockImplementation(async (_opts, cb) => {
    push = cb;
    return { remove };
  });
  const hook = await renderHook(() => useCaptureAccuracyGate());
  await waitFor(() => expect(watchPosition).toHaveBeenCalled());
  const emit = (accuracy: number | null) => act(() => push(fix(accuracy)));
  return { ...hook, emit, remove };
}

beforeEach(() => {
  jest.clearAllMocks();
  requestPermission.mockResolvedValue({ granted: true } as any);
});

describe("useCaptureAccuracyGate", () => {
  it("starts acquiring and locked", async () => {
    const { result } = await startGate();
    expect(result.current).toMatchObject({
      status: "acquiring",
      isReady: false,
      accuracy: null,
      position: null,
    });
  });

  it("watches at the highest accuracy without a distance filter", async () => {
    await startGate();
    expect(watchPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 0,
      }),
      expect.any(Function),
    );
  });

  it("stays locked while the fix is worse than 4 m", async () => {
    const { result, emit } = await startGate();
    await emit(12.5);
    expect(result.current).toMatchObject({
      status: "imprecise",
      isReady: false,
      accuracy: 12.5,
    });
  });

  it("unlocks once the fix is within 4 m", async () => {
    const { result, emit } = await startGate();
    await emit(3.2);
    expect(result.current.status).toBe("ready");
    expect(result.current.isReady).toBe(true);
    expect(result.current.position?.coords.accuracy).toBe(3.2);
  });

  it("re-locks when accuracy degrades", async () => {
    const { result, emit } = await startGate();
    await emit(2);
    await emit(9);
    expect(result.current.isReady).toBe(false);
  });

  it("keeps capture locked when accuracy is not reported", async () => {
    const { result, emit } = await startGate();
    await emit(null);
    expect(result.current).toMatchObject({ status: "unknown", isReady: false });
  });

  it("reports denied permission and never watches", async () => {
    requestPermission.mockResolvedValue({ granted: false } as any);
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(result.current.error).toMatch(/permission/i);
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it("reports watcher failures", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    watchPosition.mockRejectedValue(new Error("GPS off"));
    const { result } = await renderHook(() => useCaptureAccuracyGate());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("GPS off");
  });

  it("does nothing while disabled", async () => {
    await renderHook(() => useCaptureAccuracyGate(false));
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("stops watching on unmount", async () => {
    const { unmount, remove } = await startGate();
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
