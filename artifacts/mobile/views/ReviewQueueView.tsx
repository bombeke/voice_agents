import { ReviewCard } from "@/components/review/ReviewCard";
import { ReviewFilterChips } from "@/components/review/ReviewFilterChips";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { Routes } from "@/services/Routes";
import type { ReviewItem } from "@/types/Review";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { FlatList, Text, View } from "react-native";

/**
 * Supervisor Review tab: records routed for low AI confidence, unverified
 * GPS, heavy edits or a possible duplicate, filtered by reason. Each card
 * opens its record, and is approved or rejected (with a reason) in place.
 */
export function ReviewQueueView() {
  const router = useRouter();
  const { items, total, filter, setFilter, approve, reject } = useReviewQueue();

  // Same instance for every card, so the memoised cards skip re-rendering.
  const openRecord = useCallback(
    ({ captureId }: ReviewItem) =>
      captureId &&
      router.push({
        pathname: Routes.RECORD_DETAIL,
        params: { id: captureId },
      }),
    [router],
  );

  const r = strings.review;
  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="pt-safe-offset-6 pb-10 px-5 gap-2.5"
      data={items}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View className="gap-4 pb-1.5">
          <View className="gap-1">
            <Text className="type-overline text-text-muted">{r.overline}</Text>
            <Text accessibilityRole="header" className="type-h1 text-text">
              {fill(r.title, { count: total })}
            </Text>
          </View>
          <ReviewFilterChips value={filter} onChange={setFilter} />
        </View>
      }
      ListEmptyComponent={
        <InfoNote>{total === 0 ? r.empty.all : r.empty.filtered}</InfoNote>
      }
      renderItem={({ item }) => (
        <ReviewCard
          item={item}
          onOpen={openRecord}
          onApprove={approve}
          onReject={reject}
        />
      )}
    />
  );
}
