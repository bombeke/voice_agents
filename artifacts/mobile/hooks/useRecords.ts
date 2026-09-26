import { useKeysetWindow, useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import {
  groupByDay,
  type RecordCounts,
  type RecordFilter,
} from "@/helpers/records";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  captureCounts,
  captureListQuery,
} from "@/services/storage/repos/CaptureRepo";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { refreshTeamRecords } from "@/services/sync/ReviewSync";
import { syncActivity$ } from "@/services/sync/SyncRuntime";
import type { RecordScope } from "@/db/schema";
import { useSelector } from "@legendapp/state/react";
import { COLD_START_MARK } from "@/constants/Config";
import { endMark } from "@/db/Timing";
import { useCallback, useEffect, useMemo, useState } from "react";

/** The user's own records, or their team's (supervisors and admins). */
export type { RecordScope };

const TABLES_READ = [TABLES.captures] as const;
export const RECORDS_PAGE_SIZE = 50;

const NO_COUNTS: RecordCounts = {
  all: 0,
  pending: 0,
  flagged: 0,
  uploading: 0,
  failed: 0,
};

/**
 * The Records tab's state: tab counts, the filtered records grouped by day,
 * the search box, "Sync now" for the user's own records, and refreshing the
 * team's. The list is a keyset-paginated window: only the rows loaded so far
 * are in memory (`loadMore` reads the next page), and counts come from
 * indexed aggregates, never from loading every record.
 */
export function useRecords(
  initialFilter: RecordFilter = "all",
  scope: RecordScope = "mine",
) {
  const online = useSelector(isOnline$);
  const busy = useSelector(
    () => syncActivity$.outbox.get() || syncActivity$.photos.get(),
  );
  const [filter, setFilter] = useState<RecordFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const list = useKeysetWindow(
    TABLES_READ,
    captureListQuery(scope, filter, query),
    [scope, filter, query],
    RECORDS_PAGE_SIZE,
    "records",
  );
  const counts = useLiveQuery(
    TABLES_READ,
    (orm) => captureCounts(orm, scope),
    [scope],
    NO_COUNTS,
    "records.counts",
  );
  // "Sync now" is about the user's own uploads, whichever list shows.
  const ownCounts = useLiveQuery(
    TABLES_READ,
    (orm) => captureCounts(orm, "mine"),
    [],
    NO_COUNTS,
    "records.own",
  );
  const sections = useMemo(() => groupByDay(list.rows), [list.rows]);

  // Debug timing: the frame after the first page is rendered.
  useEffect(() => {
    if (list.loaded) requestAnimationFrame(() => endMark(COLD_START_MARK));
  }, [list.loaded]);

  const refreshTeam = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTeamRecords();
    } finally {
      setRefreshing(false);
    }
  }, []);

  /** Closing the search also clears it, so no hidden query narrows the list. */
  const toggleSearch = useCallback(() => {
    if (searchOpen) setQuery("");
    setSearchOpen(!searchOpen);
  }, [searchOpen]);

  return {
    counts,
    ownCounts,
    sections,
    loaded: list.loaded,
    hasMore: list.hasMore,
    loadMore: list.loadMore,
    online,
    syncing: busy && ownCounts.pending > 0,
    sync: syncPendingCaptures,
    refreshing,
    refreshTeam,
    filter,
    setFilter,
    query,
    setQuery,
    searchOpen,
    toggleSearch,
  };
}
