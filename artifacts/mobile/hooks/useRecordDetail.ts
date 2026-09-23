import { findRecord } from "@/helpers/records";
import { recordHistory } from "@/helpers/recordDetail";
import { captures$ } from "@/services/storage/CaptureStore";
import { records$ } from "@/services/storage/RecordStore";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

/**
 * One record for the detail screen, by capture id or asset code (the Map
 * links by code and gets that asset's newest capture). The summary carries
 * the sync state; null when either half isn't on the device.
 */
export function useRecordDetail(id: string) {
  const captures = useSelector(captures$);
  const records = useSelector(records$);

  return useMemo(() => {
    const summary = findRecord(captures, id);
    const record = summary ? records[summary.id] : undefined;
    if (!summary || !record) return null;
    return { summary, record, history: recordHistory(records, record) };
  }, [captures, records, id]);
}
