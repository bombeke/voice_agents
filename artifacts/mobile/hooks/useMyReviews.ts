import { useLiveQuery } from "@/db/LiveQuery";
import { TABLES } from "@/db/schema";
import type { MyReview } from "@/helpers/reviewQueue";
import { myReviewRows } from "@/services/storage/repos/CaptureRepo";

const TABLES_READ = [TABLES.captures, TABLES.reviewStatus] as const;
const NONE: MyReview[] = [];

/** The user's own records under review and where each one stands. */
export function useMyReviews(): MyReview[] {
  return useLiveQuery(
    TABLES_READ,
    (orm) => myReviewRows(orm),
    [],
    NONE,
    "my-reviews",
  );
}
