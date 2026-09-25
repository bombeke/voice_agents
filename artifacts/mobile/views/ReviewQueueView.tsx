import { MyReviewRow } from "@/components/review/MyReviewRow";
import { ReviewBatchHeader } from "@/components/review/ReviewBatchHeader";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ReviewFilterChips } from "@/components/review/ReviewFilterChips";
import { InfoNote } from "@/components/ui/InfoNote";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import type { MyReview } from "@/helpers/reviewQueue";
import { useMyReviews } from "@/hooks/useMyReviews";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { Routes } from "@/services/Routes";
import type { ReviewItem } from "@/types/Review";
import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";

type Scope = "team" | "mine";
const SCOPES: readonly Scope[] = ["team", "mine"];

const r = strings.review;
const LIST_CLASS = "flex-1 bg-background";
const CONTENT_CLASS = "pt-safe-offset-6 pb-10 px-5 gap-2.5";

/** Opens a record by id: the user's own, or a downloaded team record. */
function useOpenRecord() {
  const router = useRouter();
  return useCallback(
    (id: string) =>
      router.push({ pathname: Routes.RECORD_DETAIL, params: { id } }),
    [router],
  );
}

function Heading({
  overline,
  title,
  children,
}: {
  overline: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View className="gap-4 pb-1.5">
      <View className="gap-1">
        <Text className="type-overline text-text-muted">{overline}</Text>
        <Text accessibilityRole="header" className="type-h1 text-text">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Downloaded batches of other enumerators' routed records: filter by reason,
 * approve or reject (offline too), and fetch the next batch when online.
 */
function TeamQueue({ switcher }: { switcher: ReactNode }) {
  const openRecord = useOpenRecord();
  const queue = useReviewQueue();
  const { items, total, filter, setFilter, approve, reject } = queue;

  // Same instance for every card, so the memoised cards skip re-rendering.
  const openItem = useCallback(
    ({ captureId }: ReviewItem) => captureId && openRecord(captureId),
    [openRecord],
  );

  return (
    <FlatList
      className={LIST_CLASS}
      contentContainerClassName={CONTENT_CLASS}
      data={items}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Heading overline={r.overline} title={fill(r.title, { count: total })}>
          {switcher}
          <ReviewBatchHeader
            batch={queue.batch}
            unsent={queue.unsent}
            online={queue.online}
            downloading={queue.downloading}
            lastDownload={queue.lastDownload}
            onDownload={queue.download}
          />
          {total > 0 ? (
            <ReviewFilterChips value={filter} onChange={setFilter} />
          ) : null}
        </Heading>
      }
      ListEmptyComponent={
        <InfoNote>{total === 0 ? r.empty.all : r.empty.filtered}</InfoNote>
      }
      renderItem={({ item }) => (
        <ReviewCard
          item={item}
          onOpen={openItem}
          onApprove={approve}
          onReject={reject}
        />
      )}
    />
  );
}

/** The user's own routed records and the supervisor's verdict on each. */
function MyReviews({ switcher }: { switcher: ReactNode }) {
  const openRecord = useOpenRecord();
  const reviews = useMyReviews();
  const openReview = useCallback(
    ({ capture }: MyReview) => openRecord(capture.id),
    [openRecord],
  );

  return (
    <FlatList
      className={LIST_CLASS}
      contentContainerClassName={CONTENT_CLASS}
      data={reviews}
      keyExtractor={(review) => review.capture.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Heading
          overline={r.mine.overline}
          title={fill(r.mine.title, { count: reviews.length })}
        >
          {switcher}
          <Text className="type-body text-text-muted">{r.mine.intro}</Text>
        </Heading>
      }
      ListEmptyComponent={<InfoNote>{r.mine.empty}</InfoNote>}
      renderItem={({ item }) => (
        <View className="bg-surface border border-border rounded-2xl overflow-hidden">
          <MyReviewRow review={item} onPress={openReview} />
        </View>
      )}
    />
  );
}

/**
 * Review tab. Everyone sees where their own routed records stand; a user who
 * can decide (supervisor, admin) also gets the team queue, and starts there.
 */
export function ReviewQueueView({ canDecide }: { canDecide: boolean }) {
  const [scope, setScope] = useState<Scope>(canDecide ? "team" : "mine");
  const switcher = canDecide ? (
    <SegmentedControl
      role="tablist"
      label={r.scopes.label}
      options={SCOPES}
      value={scope}
      onChange={setScope}
      labels={{ team: r.scopes.team, mine: r.scopes.mine }}
    />
  ) : null;

  return canDecide && scope === "team" ? (
    <TeamQueue switcher={switcher} />
  ) : (
    <MyReviews switcher={switcher} />
  );
}
