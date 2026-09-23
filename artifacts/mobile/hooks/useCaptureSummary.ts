import { latestCapture, summariseToday } from "@/helpers/captureStats";
import { captures$, gnssStatus$ } from "@/services/storage/CaptureStore";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

/** Today's counts, the pending queue size and the newest capture. */
export function useCaptureSummary() {
  const captures = useSelector(captures$);
  const gnss = useSelector(gnssStatus$);
  return useMemo(
    () => ({
      stats: summariseToday(captures),
      latest: latestCapture(captures),
      gnss,
    }),
    [captures, gnss],
  );
}
