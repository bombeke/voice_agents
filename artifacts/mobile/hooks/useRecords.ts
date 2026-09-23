import {
  countRecords,
  filterRecords,
  groupByDay,
  type RecordFilter,
} from "@/helpers/records";
import { captures$ } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/LegendState";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useMemo, useState } from "react";

/**
 * The Records tab's state: tab counts, the filtered records grouped by day,
 * the search box, and "Sync now". `syncing` comes from the store, so it also
 * shows an upload started elsewhere.
 */
export function useRecords(initialFilter: RecordFilter = "all") {
  const captures = useSelector(captures$);
  const online = useSelector(isOnline$);
  const [filter, setFilter] = useState<RecordFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const counts = useMemo(() => countRecords(captures), [captures]);
  const sections = useMemo(
    () => groupByDay(filterRecords(captures, filter, query)),
    [captures, filter, query],
  );

  /** Closing the search also clears it, so no hidden query narrows the list. */
  const toggleSearch = useCallback(() => {
    if (searchOpen) setQuery("");
    setSearchOpen(!searchOpen);
  }, [searchOpen]);

  return {
    counts,
    sections,
    online,
    syncing: counts.uploading > 0,
    sync: syncPendingCaptures,
    filter,
    setFilter,
    query,
    setQuery,
    searchOpen,
    toggleSearch,
  };
}
