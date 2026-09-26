import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import type { ReviewFilter } from "@/helpers/reviewQueue";
import { isOnline$ } from "@/services/storage/NetworkState";
import {
  lastReviewBatch,
  reviewCounts,
  reviewQueue,
} from "@/services/storage/repos/ReviewRepo";
import { decideReview } from "@/services/storage/ReviewStore";
import {
  downloadReviewBatch,
  type DownloadResult,
} from "@/services/sync/ReviewSync";
import type { RejectReason, ReviewBatch, ReviewItem } from "@/types/Review";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useState } from "react";

const TABLES_READ = [
  TABLES.reviewItems,
  TABLES.reviewDecisions,
  TABLES.syncState,
] as const;

const EMPTY = {
  items: [] as ReviewItem[],
  total: 0,
  unsent: 0,
  batch: null as ReviewBatch | null,
};

/**
 * The supervisor's Review state: the reason filter, the downloaded queue it
 * narrows (newest first), approve / reject, the last batch, decisions still
 * to upload, and downloading the next batch. Callbacks are stable so
 * memoised cards skip re-rendering.
 */
export function useReviewQueue() {
  const online = useSelector(isOnline$);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [downloading, setDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<DownloadResult | null>(null);

  const data = useLiveQuery(
    TABLES_READ,
    async (orm) => {
      const [items, counts, batch] = await Promise.all([
        reviewQueue(orm, filter),
        reviewCounts(orm),
        lastReviewBatch(orm),
      ]);
      return { items, total: counts.queued, unsent: counts.unsent, batch };
    },
    [filter],
    EMPTY,
    "review",
  );

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
    items: data.items,
    total: data.total,
    filter,
    setFilter,
    approve,
    reject,
    batch: data.batch,
    unsent: data.unsent,
    online,
    downloading,
    lastDownload,
    download,
  };
}
