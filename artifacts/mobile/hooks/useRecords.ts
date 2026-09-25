import {
  countRecords,
  filterRecords,
  groupByDay,
  type RecordFilter,
} from "@/helpers/records";
import { captures$ } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/LegendState";
import { teamRecords$ } from "@/services/storage/ReviewStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { refreshTeamRecords } from "@/services/sync/ReviewSync";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useMemo, useState } from "react";

/** The user's own records, or their team's (supervisors and admins). */
export type RecordScope = "mine" | "team";

/**
 * The Records tab's state: tab counts, the filtered records grouped by day,
 * the search box, "Sync now" for the user's own records, and refreshing the
 * team's. `syncing` comes from the store, so it also shows an upload started
 * elsewhere.
 */
export function useRecords(
  initialFilter: RecordFilter = "all",
  scope: RecordScope = "mine",
) {
  const own = useSelector(captures$);
  const team = useSelector(teamRecords$);
  const online = useSelector(isOnline$);
  const [filter, setFilter] = useState<RecordFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const captures = useMemo(
    () => (scope === "team" ? Object.values(team).map((r) => r.summary) : own),
    [scope, team, own],
  );
  // "Sync now" is about the user's own uploads, whichever list shows.
  const ownCounts = useMemo(() => countRecords(own), [own]);
  const counts = useMemo(() => countRecords(captures), [captures]);
  const sections = useMemo(
    () => groupByDay(filterRecords(captures, filter, query)),
    [captures, filter, query],
  );

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
    online,
    syncing: ownCounts.uploading > 0,
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
