import { isOnline$ } from "@/services/storage/LegendState";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-native";
import { useNetworkStatus } from "../useNetworkStatus";

jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);
jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));

const state = (over: Partial<NetInfoState>) =>
  ({ isConnected: true, isInternetReachable: true, ...over }) as NetInfoState;

describe("useNetworkStatus", () => {
  let listener: (s: NetInfoState) => void;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    isOnline$.set(true);
    jest.mocked(NetInfo.addEventListener).mockImplementation((fn) => {
      listener = fn;
      return unsubscribe;
    });
  });

  it("follows the connection and stops listening on unmount", async () => {
    const { unmount } = await renderHook(() => useNetworkStatus());

    await act(() => listener(state({ isConnected: false })));
    expect(isOnline$.get()).toBe(false);
    await act(() => listener(state({ isInternetReachable: false })));
    expect(isOnline$.get()).toBe(false);
    // Reachability not known yet still counts as online.
    await act(() => listener(state({ isInternetReachable: null })));
    expect(isOnline$.get()).toBe(true);

    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
