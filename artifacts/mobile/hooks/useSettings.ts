import { countRecords } from "@/helpers/records";
import { storageBreakdown } from "@/helpers/settings";
import { captures$ } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/LegendState";
import {
  applyModelUpdate,
  clearSyncedPhotos,
  deviceStatus$,
  setSetting,
  settings$,
} from "@/services/storage/SettingsStore";
import { syncPendingCaptures } from "@/services/sync/CaptureSync";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

/**
 * The Settings screen's state: the user's choices and a setter, the device
 * status (model, storage, last sync), and the pending queue with "Sync now".
 * The actions are module functions, so they're stable across renders.
 */
export function useSettings() {
  const settings = useSelector(settings$);
  const status = useSelector(deviceStatus$);
  const captures = useSelector(captures$);
  const online = useSelector(isOnline$);

  const counts = useMemo(() => countRecords(captures), [captures]);
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
    syncing: counts.uploading > 0,
    online,
    sync: syncPendingCaptures,
    downloadModel: applyModelUpdate,
    clearSyncedPhotos,
  };
}
