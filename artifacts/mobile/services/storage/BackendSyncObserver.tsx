import { useObserve } from "@legendapp/state/react";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import {
  authStore$,
  isOnline$,
  mergeRemotePoles,
  refreshRemotePoles,
  remotePoles$,
} from "./LegendState";

/**
 * Owns the pull side of sync: connectivity, refetching, and merging the
 * server's poles into the local (persisted) store the dashboard reads from.
 */
export function BackendSyncObserver() {
  /** 🔹 React to auth changes */
  useObserve(() => {
    if (!authStore$.get()) return;
    refreshRemotePoles();
  });

  /** 🔹 Track network state and app focus, and feed them to TanStack Query so it
   *  pauses fetches while offline and refetches on reconnect / foreground. */
  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      // isConnected is null while unknown; only treat an explicit false as offline.
      const online = state.isConnected !== false;
      isOnline$.set(online);
      onlineManager.setOnline(online);
    });
    const appState = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => {
      if (typeof unsubNet === "function") unsubNet();
      else (unsubNet as any)?.remove?.();
      appState.remove();
    };
  }, []);

  /** 🔹 Merge every fresh server snapshot into local storage */
  useObserve(() => {
    const remote = remotePoles$.get();
    if (Array.isArray(remote)) mergeRemotePoles(remote);
  });

  return null;
}
