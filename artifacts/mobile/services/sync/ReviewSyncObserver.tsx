import { dbEpoch$ } from "@/db/Current";
import { isOnline$ } from "@/services/storage/NetworkState";
import { useEffect } from "react";
import { AppState } from "react-native";
import { refreshMyReviews } from "./ReviewSync";

/**
 * Keeps the user's own review statuses fresh on sign-in, reconnect and
 * foreground. Decisions are delivered by the outbox worker.
 */
export function ReviewSyncObserver() {
  useEffect(() => {
    const sync = () => {
      refreshMyReviews();
    };
    sync();
    const offUser = dbEpoch$.onChange(sync);
    const offOnline = isOnline$.onChange(({ value }) => {
      if (value) sync();
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      offUser();
      offOnline();
      appState.remove();
    };
  }, []);

  return null;
}
