import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import type { RecordCounts } from "@/helpers/records";
import { storageBreakdown } from "@/helpers/settings";
import { isOnline$ } from "@/services/storage/NetworkState";
import { captureCounts } from "@/services/storage/repos/CaptureRepo";
import {
  applyModelUpdate,
  clearSyncedPhotos,
  deviceStatus$,
  setSetting,
  settings$,
} from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { syncActivity$ } from "@/services/sync/SyncRuntime";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

const TABLES_READ = [TABLES.captures] as const;
const NO_COUNTS: RecordCounts = {
  all: 0,
  pending: 0,
  flagged: 0,
  uploading: 0,
  failed: 0,
};

/**
 * The Settings screen's state: the user's choices and a setter, the device
 * status (model, storage, last sync), and the pending queue with "Sync now".
 * The actions are module functions, so they're stable across renders.
 */
export function useSettings() {
  const settings = useSelector(settings$);
  const status = useSelector(deviceStatus$);
  const online = useSelector(isOnline$);
  const busy = useSelector(
    () => syncActivity$.outbox.get() || syncActivity$.photos.get(),
  );
  const counts = useLiveQuery(
    TABLES_READ,
    (orm) => captureCounts(orm, "mine"),
    [],
    NO_COUNTS,
    "settings.counts",
  );

  const storage = useMemo(
    () => storageBreakdown(status.storage),
    [status.storage],
  );

  return {
    settings,
    set: setSetting,
    status,
    storage,
    pending: counts.pending,
    syncing: busy && counts.pending > 0,
    online,
    sync: syncPendingCaptures,
    downloadModel: applyModelUpdate,
    clearSyncedPhotos,
  };
}
