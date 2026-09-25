import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { formatRecordMeta } from "@/helpers/records";
import type { MyReview } from "@/helpers/reviewQueue";
import type { MyReviewState } from "@/types/Review";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

const m = strings.review.mine;

const TONE: Record<MyReviewState, ChipTone> = {
  waiting: "warning",
  approved: "success",
  rejected: "danger",
};

interface MyReviewRowProps {
  review: MyReview;
  onPress: (review: MyReview) => void;
}

/**
 * One of the user's records under review: icon, name, meta, the verdict chip
 * and, when rejected, why. Read-only; the record opens for editing.
 */
export const MyReviewRow = memo(function MyReviewRow({
  review,
  onPress,
}: MyReviewRowProps) {
  const { capture, status } = review;
  const state = m.states[status.state];
  const meta = formatRecordMeta(capture);
  const note =
    status.state === "rejected" && status.rejectReason
      ? fill(m.rejectedBecause, {
          reason: strings.review.rejectReasons[status.rejectReason],
        })
      : status.state === "waiting"
        ? m.waitingNote
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fill(m.rowLabel, {
        title: capture.title,
        meta,
        state,
      })}
      onPress={() => onPress(review)}
      className="min-h-16 gap-1.5 px-3.5 py-2.5 active:bg-surface-muted"
    >
      <View className="flex-row items-center gap-3">
        <CategoryIcon category={capture.category} size="md" />
        <View className="flex-1 gap-0.5">
          <Text className="type-body-strong text-text" numberOfLines={1}>
            {capture.title}
          </Text>
          <Text className="type-caption text-text-muted" numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Chip label={state} tone={TONE[status.state]} />
      </View>
      {note ? (
        <Text className="type-body-small text-text-muted pl-[52px]">
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
});
