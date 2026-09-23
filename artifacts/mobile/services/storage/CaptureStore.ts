import type {
  CaptureSummary,
  CaptureSyncStatus,
  GnssStatus,
} from "@/types/Capture";
import { observable } from "@legendapp/state";

export const CAPTURES_STORAGE_KEY = "iip_captures_v1";

/** Local capture list; persisted to MMKV by `initPersistence()` in LegendState.ts. */
export const captures$ = observable<CaptureSummary[]>([]);

/** Latest GNSS receiver state; `null` until the first fix. */
export const gnssStatus$ = observable<GnssStatus | null>(null);

/**
 * Upserts by id, keeping the row's position. Updates stay immutable: Legend
 * mutates arrays in place on child sets, which memoised readers wouldn't see.
 */
export function addCapture(capture: CaptureSummary) {
  captures$.set((prev) => {
    const i = prev.findIndex((c) => c.id === capture.id);
    return i < 0
      ? [...prev, capture]
      : prev.map((row, j) => (j === i ? capture : row));
  });
}

/** Moves the given records to a new sync state. */
export function setCaptureStatus(
  ids: Iterable<string>,
  status: CaptureSyncStatus,
) {
  const wanted = new Set(ids);
  if (!wanted.size) return;
  captures$.set((prev) =>
    prev.map((c) =>
      wanted.has(c.id) && c.syncStatus !== status
        ? { ...c, syncStatus: status }
        : c,
    ),
  );
}

export function replaceCaptures(captures: CaptureSummary[]) {
  captures$.set(captures);
}

export function clearCaptures() {
  captures$.set([]);
}
