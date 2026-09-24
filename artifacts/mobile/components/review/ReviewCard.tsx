import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { AssetCategory } from "@/constants/Colors";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import {
  CATEGORY_CODES,
  formatReviewMeta,
  formatReviewReason,
  REJECT_REASONS,
} from "@/helpers/reviewQueue";
import type { RejectReason, ReviewItem } from "@/types/Review";
import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";

/** Full class names so Tailwind can see them. */
const TILE: Record<AssetCategory, string> = {
  energy: "bg-energy-tile",
  water: "bg-water-tile",
  telecom: "bg-telecom-tile",
  roads: "bg-roads-tile",
};
const CODE: Record<AssetCategory, string> = {
  energy: "text-energy",
  water: "text-water",
  telecom: "text-telecom",
  roads: "text-roads",
};

interface ReviewCardProps {
  item: ReviewItem;
  /** Opens the reviewed record; the header is plain text without it or a capture. */
  onOpen?: (item: ReviewItem) => void;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem, reason: RejectReason) => void;
}

/**
 * One queued record: code tile, name, "Enumerator 04 · today 09:20", why it
 * was flagged, and Reject / Approve. Reject asks for a reason inline before
 * it is confirmed. Memoised: a decision re-renders only the cards that changed.
 */
export const ReviewCard = memo(function ReviewCard({
  item,
  onOpen,
  onApprove,
  onReject,
}: ReviewCardProps) {
  const r = strings.review;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason | null>(null);
  const meta = formatReviewMeta(item);
  const vars = { title: item.title };

  const header = (
    <>
      <View
        className={`w-11 h-11 rounded-xl items-center justify-center ${TILE[item.category]}`}
      >
        <Text className={`type-title font-heading ${CODE[item.category]}`}>
          {CATEGORY_CODES[item.category]}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="type-title text-text" numberOfLines={2}>
          {item.title}
        </Text>
        <Text className="type-body-small text-text-muted" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </>
  );
  const headerClass = "flex-row items-center gap-3 min-h-11";

  const cancelReject = () => {
    setRejecting(false);
    setReason(null);
  };

  return (
    <Card className="gap-3">
      {onOpen && item.captureId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fill(r.openRecord, { title: item.title, meta })}
          onPress={() => onOpen(item)}
          className={`${headerClass} rounded-xl active:bg-surface-muted`}
        >
          {header}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityLabel={`${item.title}, ${meta}`}
          className={headerClass}
        >
          {header}
        </View>
      )}

      {/* Grows to fit, so a long reason wraps inside the pill. */}
      <View className="self-start max-w-full rounded-2xl px-2.5 py-1 bg-danger-soft">
        <Text className="type-chip text-on-danger-soft">
          {formatReviewReason(item.reason)}
        </Text>
      </View>

      {rejecting ? (
        <View className="gap-3">
          <Text className="type-label text-text">
            {fill(r.rejectReasonLabel, vars)}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={fill(r.rejectReasonLabel, vars)}
            className="flex-row flex-wrap gap-2"
          >
            {REJECT_REASONS.map((option) => (
              <Chip
                key={option}
                role="radio"
                label={r.rejectReasons[option]}
                selected={option === reason}
                onPress={() => setReason(option)}
              />
            ))}
          </View>
          <View className="flex-row gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onPress={cancelReject}
            >
              {r.cancel}
            </Button>
            <Button
              variant="dark"
              className="flex-1"
              disabled={!reason}
              onPress={() => reason && onReject(item, reason)}
            >
              {r.confirmReject}
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            accessibilityLabel={fill(r.rejectLabel, vars)}
            onPress={() => setRejecting(true)}
          >
            <Text className="type-body-strong text-danger">{r.reject}</Text>
          </Button>
          <Button
            className="flex-1"
            accessibilityLabel={fill(r.approveLabel, vars)}
            onPress={() => onApprove(item)}
          >
            {r.approve}
          </Button>
        </View>
      )}
    </Card>
  );
});
