import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import type { TodayStats } from "@/helpers/captureStats";
import { gnssStatus$ } from "@/services/storage/CaptureStore";
import {
  latestCapture,
  todayStats,
} from "@/services/storage/repos/CaptureRepo";
import type { CaptureSummary } from "@/types/Capture";
import { COLD_START_MARK } from "@/constants/Config";
import { endMark } from "@/db/Timing";
import { useSelector } from "@legendapp/state/react";
import { useEffect } from "react";

const TABLES_READ = [TABLES.captures] as const;

const EMPTY: { stats: TodayStats; latest: CaptureSummary | undefined } = {
  stats: { capturedToday: 0, synced: 0, flagged: 0, pending: 0 },
  latest: undefined,
};

/** Today's counts, the pending queue size and the newest capture, from indexed aggregates. */
export function useCaptureSummary() {
  const gnss = useSelector(gnssStatus$);
  const data = useLiveQuery(
    TABLES_READ,
    async (orm) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      const [stats, latest] = await Promise.all([
        todayStats(orm, start.getTime(), end.getTime()),
        latestCapture(orm),
      ]);
      return { stats, latest };
    },
    [],
    EMPTY,
    "home",
  );
  // Debug timing: Home's latest record is the first list-like paint.
  useEffect(() => {
    if (data !== EMPTY) requestAnimationFrame(() => endMark(COLD_START_MARK));
  }, [data]);
  return { ...data, gnss };
}
