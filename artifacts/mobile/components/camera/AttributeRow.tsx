import { strings } from "@/constants/Strings";
import { formatAttributeValue, isEditable } from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import type { DetectionAttribute } from "@/types/Capture";
import { Pressable, Text, View } from "react-native";

const SOURCE_TONE = {
  high: "text-success",
  medium: "text-warning",
  low: "text-danger",
  none: "text-text-muted",
} as const;

/** "AI · high", "AR · from range", "GIS", "User": every value shows where it came from (§4.2). */
export function sourceLabel({ source, confidence }: DetectionAttribute) {
  if (source === "ai" && confidence)
    return strings.capture.review.source[confidence];
  return strings.capture.review.source[source];
}

interface AttributeRowProps {
  attribute: DetectionAttribute;
  /** Opens the correction picker; only called for editable values. */
  onEdit?: () => void;
}

/**
 * One attribute of a detection: label, value, and its source and confidence.
 * Low-confidence AI values are highlighted with "Please check" (§6.2).
 */
export function AttributeRow({ attribute, onEdit }: AttributeRowProps) {
  const label = strings.attributes[attribute.key].label;
  const value = formatAttributeValue(attribute.key, attribute.value);
  const low = attribute.source === "ai" && attribute.confidence === "low";
  const tone =
    attribute.source === "ai" && attribute.confidence
      ? SOURCE_TONE[attribute.confidence]
      : attribute.source === "ar"
        ? SOURCE_TONE.high
        : attribute.source === "sensor"
          ? SOURCE_TONE.medium
          : SOURCE_TONE.none;
  const editable = !!onEdit && isEditable(attribute);

  const content = (
    <>
      <Text className="w-[38%] type-body-small text-text-muted">{label}</Text>
      <View className="flex-1">
        {value ? (
          <Text className="type-body-strong text-text">{value}</Text>
        ) : (
          <Text className="type-body-small text-text-muted">
            {attribute.source === "gis"
              ? strings.capture.review.gisPending
              : attribute.source === "ar" || attribute.source === "sensor"
                ? strings.capture.review.notMeasured
                : strings.capture.review.pending}
          </Text>
        )}
        {low ? (
          <Text className="type-caption text-warning">
            {strings.capture.review.pleaseCheck}
          </Text>
        ) : null}
      </View>
      <Text className={`type-chip ${tone}`}>{sourceLabel(attribute)}</Text>
    </>
  );

  const rowClass = `min-h-[52px] px-4 py-3 flex-row items-center gap-3 ${low ? "bg-warning-soft" : ""}`;

  if (!editable) return <View className={rowClass}>{content}</View>;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={fill(strings.capture.review.edit, {
        attribute: label.toLowerCase(),
      })}
      accessibilityHint={`${value} · ${sourceLabel(attribute)}`}
      className={`${rowClass} active:bg-surface-muted`}
    >
      {content}
    </Pressable>
  );
}
