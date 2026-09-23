import { isOnline$ } from "@/services/storage/LegendState";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect } from "react";

/** Unknown reachability (null) counts as online so sync still tries. */
const online = (state: NetInfoState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

/**
 * Keeps `isOnline$` in step with the device's connection, for the sync
 * banner, the op-queue replay and the Map's offline badge. Mount once.
 */
export function useNetworkStatus() {
  useEffect(
    () => NetInfo.addEventListener((state) => isOnline$.set(online(state))),
    [],
  );
}
