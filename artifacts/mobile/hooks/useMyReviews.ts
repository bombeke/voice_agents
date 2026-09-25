import { myReviews } from "@/helpers/reviewQueue";
import { captures$ } from "@/services/storage/CaptureStore";
import { myReviewStatus$ } from "@/services/storage/ReviewStore";
import { useSelector } from "@legendapp/state/react";
import { useMemo } from "react";

/** The user's own records under review and where each one stands. */
export function useMyReviews() {
  const captures = useSelector(captures$);
  const statuses = useSelector(myReviewStatus$);
  return useMemo(() => myReviews(captures, statuses), [captures, statuses]);
}
