import type { CaptureSummary, GnssStatus } from "@/types/Capture";
import { observable } from "@legendapp/state";

export const CAPTURES_STORAGE_KEY = "iip_captures_v1";

/** Local capture list; persisted to MMKV by `initPersistence()` in LegendState.ts. */
export const captures$ = observable<CaptureSummary[]>([]);

/** Latest GNSS receiver state; `null` until the first fix. */
export const gnssStatus$ = observable<GnssStatus | null>(null);

/** Upserts by id so a re-saved capture replaces its earlier row. */
export function addCapture(capture: CaptureSummary) {
  captures$.set((prev) => [
    ...prev.filter((c) => c.id !== capture.id),
    capture,
  ]);
}

export function replaceCaptures(captures: CaptureSummary[]) {
  captures$.set(captures);
}

export function clearCaptures() {
  captures$.set([]);
}
