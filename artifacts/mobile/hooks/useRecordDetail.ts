import { findRecord } from "@/helpers/records";
import { recordHistory } from "@/helpers/recordDetail";
import { captures$ } from "@/services/storage/CaptureStore";
import { records$ } from "@/services/storage/RecordStore";
import { teamRecords$ } from "@/services/storage/ReviewStore";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

/**
 * One record for the detail screen, by capture id or asset code (the Map
 * links by code and gets that asset's newest capture). The user's own
 * records come first; otherwise a team record a supervisor downloaded, which
 * is read-only (`own: false`). Null when it isn't on the device.
 */
export function useRecordDetail(id: string) {
  const captures = useSelector(captures$);
  const records = useSelector(records$);
  const team = useSelector(teamRecords$);

  return useMemo(() => {
    const summary = findRecord(captures, id);
    const record = summary ? records[summary.id] : undefined;
    if (summary && record) {
      return {
        summary,
        record,
        history: recordHistory(records, record),
        own: true,
      };
    }
    const teamRecord = team[id];
    if (!teamRecord) return null;
    return {
      summary: teamRecord.summary,
      record: teamRecord.record,
      history: [],
      own: false,
    };
  }, [captures, records, team, id]);
}
