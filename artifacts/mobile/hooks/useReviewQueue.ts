import { filterReviews, type ReviewFilter } from "@/helpers/reviewQueue";
import { decideReview, reviewQueue$ } from "@/services/storage/ReviewStore";
import type { RejectReason, ReviewItem } from "@/types/Review";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useMemo, useState } from "react";

/**
 * The Review tab's state: the reason filter, the queue it narrows (newest
 * first), the total waiting, and approve / reject. The callbacks are stable
 * so memoised cards skip re-rendering.
 */
export function useReviewQueue() {
  const queue = useSelector(reviewQueue$);
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const items = useMemo(() => filterReviews(queue, filter), [queue, filter]);

  const approve = useCallback(
    ({ id }: ReviewItem) => decideReview(id, "approved"),
    [],
  );
  const reject = useCallback(
    ({ id }: ReviewItem, reason: RejectReason) =>
      decideReview(id, "rejected", reason),
    [],
  );

  return { items, total: queue.length, filter, setFilter, approve, reject };
}
