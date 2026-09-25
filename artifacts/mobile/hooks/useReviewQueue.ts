import {
  countUnsent,
  filterReviews,
  type ReviewFilter,
} from "@/helpers/reviewQueue";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  decideReview,
  reviewBatch$,
  reviewDecisions$,
  reviewQueue$,
} from "@/services/storage/ReviewStore";
import {
  downloadReviewBatch,
  type DownloadResult,
} from "@/services/sync/ReviewSync";
import type { RejectReason, ReviewItem } from "@/types/Review";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useMemo, useState } from "react";

/**
 * The supervisor's Review state: the reason filter, the downloaded queue it
 * narrows (newest first), approve / reject, the last batch, decisions still
 * to upload, and downloading the next batch. Callbacks are stable so
 * memoised cards skip re-rendering.
 */
export function useReviewQueue() {
  const queue = useSelector(reviewQueue$);
  const batchInfo = useSelector(reviewBatch$);
  const decisions = useSelector(reviewDecisions$);
  const online = useSelector(isOnline$);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [downloading, setDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<DownloadResult | null>(null);

  const items = useMemo(() => filterReviews(queue, filter), [queue, filter]);
  const unsent = useMemo(() => countUnsent(decisions), [decisions]);

  const approve = useCallback(
    ({ id }: ReviewItem) => decideReview(id, "approved"),
    [],
  );
  const reject = useCallback(
    ({ id }: ReviewItem, reason: RejectReason) =>
      decideReview(id, "rejected", reason),
    [],
  );

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      setLastDownload(await downloadReviewBatch());
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    items,
    total: queue.length,
    filter,
    setFilter,
    approve,
    reject,
    batch: batchInfo,
    unsent,
    online,
    downloading,
    lastDownload,
    download,
  };
}
