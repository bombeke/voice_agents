import * as Location from "expo-location";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useLastKnownPosition } from "../useLastKnownPosition";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const loc = jest.mocked(Location);
const fix = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as Location.LocationObject;

beforeEach(() => {
  jest.clearAllMocks();
  loc.requestForegroundPermissionsAsync.mockResolvedValue({
    status: "granted",
  } as Location.LocationPermissionResponse);
});

describe("useLastKnownPosition", () => {
  it("uses a recent cached fix without asking for a new one", async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(fix(0.35, 32.58));
    const { result } = await renderHook(() => useLastKnownPosition());
    await waitFor(() =>
      expect(result.current.position).toEqual({
        latitude: 0.35,
        longitude: 32.58,
      }),
    );
    expect(loc.getLastKnownPositionAsync).toHaveBeenCalledWith({
      maxAge: 60_000,
    });
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("falls back to one balanced fix", async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(null);
    loc.getCurrentPositionAsync.mockResolvedValue(fix(1, 2));
    const { result } = await renderHook(() => useLastKnownPosition());
    await waitFor(() =>
      expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }),
    );
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
  });

  it("stays null when permission is denied", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as Location.LocationPermissionResponse);
    const { result } = await renderHook(() => useLastKnownPosition());
    let refreshed: unknown;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toBeNull();
    expect(result.current.position).toBeNull();
    expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when location fails", async () => {
    loc.getLastKnownPositionAsync.mockRejectedValue(new Error("no provider"));
    const { result } = await renderHook(() => useLastKnownPosition());
    let refreshed: unknown;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toBeNull();
    expect(result.current.position).toBeNull();
  });
});
