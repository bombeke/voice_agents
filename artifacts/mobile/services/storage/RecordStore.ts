import type { CaptureRecord } from "@/types/Capture";
import { observable } from "@legendapp/state";

export const RECORDS_STORAGE_KEY = "iip_records_v1";

/**
 * Full saved captures by id, behind the record detail screen; persisted to
 * MMKV by `initPersistence()` in LegendState.ts. The matching rows in
 * CaptureStore keep the list view and sync state.
 */
export const records$ = observable<Record<string, CaptureRecord>>({});

/**
 * Adds or replaces by id. Immutable like addCapture, so memoised readers of
 * the whole map see the change.
 */
export function upsertRecord(record: CaptureRecord) {
  records$.set((prev) => ({ ...prev, [record.id]: record }));
}

export function replaceRecords(records: readonly CaptureRecord[]) {
  records$.set(Object.fromEntries(records.map((r) => [r.id, r])));
}

export function clearRecords() {
  records$.set({});
}
