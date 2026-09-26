import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import { recordHistory, type HistoryEntry } from "@/helpers/recordDetail";
import {
  assetRecords,
  findCapture,
} from "@/services/storage/repos/CaptureRepo";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";

const TABLES_READ = [TABLES.captures] as const;

export interface RecordDetail {
  summary: CaptureSummary;
  record: CaptureRecord;
  history: HistoryEntry[];
  own: boolean;
}

/**
 * One record for the detail screen, by capture id or asset code (the Map
 * links by code and gets that asset's newest capture). The user's own
 * records come first; otherwise a team record a supervisor downloaded, which
 * is read-only (`own: false`). `undefined` while loading, null when it isn't
 * on the device.
 */
export function useRecordDetail(id: string): RecordDetail | null | undefined {
  return useLiveQuery<RecordDetail | null | undefined>(
    TABLES_READ,
    async (orm) => {
      const row = await findCapture(orm, id);
      if (!row?.record) return null;
      const own = row.scope === "mine";
      const history =
        own && row.record.assetId
          ? recordHistory(
              Object.fromEntries(
                (await assetRecords(orm, row.record.assetId)).map((r) => [
                  r.id,
                  r,
                ]),
              ),
              row.record,
            )
          : own
            ? recordHistory({ [row.record.id]: row.record }, row.record)
            : [];
      return { summary: row.summary, record: row.record, history, own };
    },
    [id],
    undefined,
    "record",
  );
}
