import { dbEpoch$, peekDb } from "@/db/Current";
import { useSelector } from "@legendapp/state/react";
import NetInfo from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { pullObservations } from "../sync/PullSync";
import { fetchChangesPage } from "../sync/SyncTransport";
import { onPushed, wakeSync } from "../sync/SyncRuntime";
import { deleteCaptureImage } from "./ImageStore";
import { getDeviceId } from "./LegendState";
import { isImageReferenced } from "./repos/ObservationRepo";
import { isOnline$, isUnmetered$ } from "./NetworkState";

const PULL_REFRESH_MS = 5 * 60_000;

export const pullQueryKey = (epoch: number) =>
  ["sync", "observations", epoch] as const;

/**
 * Owns connectivity and the pull side of sync. The pull is a TanStack query
 * whose queryFn writes each delta page into SQLite in its own transaction
 * and returns only `{ cursor, applied }`: SQLite is the cache, so no record
 * array ever sits in the query cache, and there is no persister.
 */
export function BackendSyncObserver() {
  const epoch = useSelector(dbEpoch$);
  const online = useSelector(isOnline$);
  const queryClient = useQueryClient();

  useQuery({
    queryKey: pullQueryKey(epoch),
    enabled: epoch > 0 && online && !!peekDb(),
    queryFn: async () => {
      const db = peekDb();
      if (!db) return { cursor: null, applied: 0 };
      const { cursor, applied, released } = await pullObservations({
        db,
        fetchPage: fetchChangesPage,
        deviceId: getDeviceId(),
      });
      // Photos of records the server deleted, once nothing points at them.
      for (const uri of released) {
        if (!(await isImageReferenced(db.orm, uri))) deleteCaptureImage(uri);
      }
      return { cursor, applied };
    },
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: PULL_REFRESH_MS,
  });

  // Our writes are in: pull the server's view (and other devices' captures).
  useEffect(() => {
    onPushed(() =>
      queryClient.invalidateQueries({ queryKey: ["sync", "observations"] }),
    );
    return () => onPushed(null);
  }, [queryClient]);

  /** Network state and app focus feed TanStack Query (pause offline, refetch on
   *  reconnect / foreground) and wake the upload workers. */
  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      // isConnected is null while unknown; only treat an explicit false as offline.
      const nowOnline = state.isConnected !== false;
      const wasOnline = isOnline$.peek();
      isOnline$.set(nowOnline);
      isUnmetered$.set(state.type === "wifi" || state.type === "ethernet");
      onlineManager.setOnline(nowOnline);
      if (nowOnline && !wasOnline) wakeSync();
    });
    const appState = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
      if (status === "active") wakeSync();
    });
    return () => {
      if (typeof unsubNet === "function") unsubNet();
      else (unsubNet as any)?.remove?.();
      appState.remove();
    };
  }, []);

  return null;
}
