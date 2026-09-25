import { isOnline$ } from "@/services/storage/NetworkState";
import { reviewDecisions$ } from "@/services/storage/ReviewStore";
import { useEffect } from "react";
import { AppState } from "react-native";
import { refreshMyReviews, uploadReviewDecisions } from "./ReviewSync";

/**
 * Sends review decisions as soon as they're made and on reconnect, and keeps
 * the user's own review statuses fresh on sign-in, reconnect and foreground.
 */
export function ReviewSyncObserver() {
  useEffect(() => {
    const sync = () => {
      uploadReviewDecisions();
      refreshMyReviews();
    };
    sync();
    const offDecisions = reviewDecisions$.onChange(() => {
      uploadReviewDecisions();
    });
    const offOnline = isOnline$.onChange(({ value }) => {
      if (value) sync();
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      offDecisions();
      offOnline();
      appState.remove();
    };
  }, []);

  return null;
}
