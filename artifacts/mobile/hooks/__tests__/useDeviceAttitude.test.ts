import { Magnetometer } from "expo-sensors";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useDeviceAttitude } from "../useDeviceAttitude";

type Listener = (v: { x: number; y: number; z: number }) => void;
const mockListeners: { accel?: Listener; mag?: Listener } = {};
const mockRemove = jest.fn();

jest.mock("expo-sensors", () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(async () => true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((l) => {
      mockListeners.accel = l;
      return { remove: mockRemove };
    }),
  },
  Magnetometer: {
    isAvailableAsync: jest.fn(async () => true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((l) => {
      mockListeners.mag = l;
      return { remove: mockRemove };
    }),
  },
}));

/** Upright portrait: +1 g on y on Android (reaction), −1 g on iOS (gravity). */
const UPRIGHT = { x: 0, y: Platform.OS === "android" ? 1 : -1, z: 0 };

beforeEach(() => {
  mockListeners.accel = undefined;
  mockListeners.mag = undefined;
  mockRemove.mockClear();
});

describe("useDeviceAttitude", () => {
  it("turns the sensor readings into the lens pose", async () => {
    const { result } = await renderHook(() => useDeviceAttitude(true, 2));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.read()).toBeNull();
    // The lens faces north, so the field points along -z and down.
    await act(() => {
      mockListeners.accel!(UPRIGHT);
      mockListeners.mag!({ x: 0, y: -40, z: -20 });
    });
    const pose = result.current.read();
    expect(pose!.headingDeg).toBeCloseTo(2, 5);
    expect(pose!.pitchDeg).toBeCloseTo(0, 5);
    expect(pose!.trueNorth).toBe(true);
  });

  it("smooths new samples into the old ones", async () => {
    const { result } = await renderHook(() => useDeviceAttitude(true, 0));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(() => {
      mockListeners.accel!(UPRIGHT);
      mockListeners.mag!({ x: 0, y: -40, z: -20 });
      // A single jolt toward "east" barely moves the heading.
      mockListeners.mag!({ x: -20, y: -40, z: 0 });
    });
    const heading = result.current.read()!.headingDeg;
    expect(heading).toBeGreaterThan(0);
    expect(heading).toBeLessThan(15);
  });

  it("reports unavailable without a magnetometer", async () => {
    jest.mocked(Magnetometer.isAvailableAsync).mockResolvedValueOnce(false);
    const { result } = await renderHook(() => useDeviceAttitude(true, null));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.read()).toBeNull();
  });

  it("stops listening when disabled", async () => {
    const { result, rerender } = await renderHook(
      ({ on }: { on: boolean }) => useDeviceAttitude(on, null),
      { initialProps: { on: true } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await rerender({ on: false });
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(result.current.read()).toBeNull();
  });
});
