import { AttributeRow } from "@/components/camera/AttributeRow";
import { Button } from "@/components/ui/Button";
import { Card, CardDivider } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import {
  formatConfidence,
  formatLabel,
  suggestionHint,
} from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import type { AttributeKey, ReviewDetection } from "@/types/Capture";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";

interface DetectionCardProps {
  detection: ReviewDetection;
  /** 1-based number matching the box on the photo. */
  number: number;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onEditAttribute: (key: AttributeKey) => void;
}

/**
 * One detection on the review screen: accepted ones list their attributes,
 * suggestions (0.40–0.70) need Accept or "Not an asset", and rejected ones
 * can be undone.
 */
export function DetectionCard(props: DetectionCardProps) {
  switch (props.detection.decision) {
    case "accepted":
      return <AcceptedCard {...props} />;
    case "suggested":
      return <SuggestedCard {...props} />;
    case "rejected":
      return <RejectedCard {...props} />;
  }
}

function NumberBadge({ number, solid }: { number: number; solid: boolean }) {
  return (
    <View
      className={`w-9 h-9 rounded-tile items-center justify-center ${solid ? "bg-accent" : "bg-surface border-2 border-text"}`}
    >
      <Text className="font-heading text-[17px] text-text">{number}</Text>
    </View>
  );
}

function AcceptedCard({
  detection,
  number,
  expanded,
  onToggle,
  onEditAttribute,
}: DetectionCardProps) {
  const label = formatLabel(detection.label);
  return (
    <Card variant="flush">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={fill(
          expanded
            ? strings.capture.review.collapse
            : strings.capture.review.expand,
          { label: `${number} ${label}` },
        )}
        accessibilityState={{ expanded }}
        className="min-h-[64px] px-4 py-3 flex-row items-center gap-3 active:bg-surface-muted"
      >
        <NumberBadge number={number} solid />
        <View className="flex-1">
          <Text className="type-title text-text">{label}</Text>
          <Text className="type-body-small text-text-muted">
            {fill(strings.capture.review.confidence, {
              confidence: formatConfidence(detection.confidence),
            })}
          </Text>
        </View>
        {expanded ? (
          <Chip
            tone="success"
            label={strings.capture.review.accepted}
            icon={<Icon name="check" size={14} color={colors.onSuccessSoft} />}
          />
        ) : (
          <View className="w-11 h-11 rounded-full bg-surface-muted items-center justify-center">
            <Icon name="chevron-down" size={20} color={colors.text} />
          </View>
        )}
      </Pressable>
      {expanded
        ? detection.attributes.map((attribute) => (
            <Fragment key={attribute.key}>
              <CardDivider />
              <AttributeRow
                attribute={attribute}
                onEdit={() => onEditAttribute(attribute.key)}
              />
            </Fragment>
          ))
        : null}
    </Card>
  );
}

function SuggestedCard({
  detection,
  number,
  onAccept,
  onReject,
}: DetectionCardProps) {
  const hint = suggestionHint(detection);
  const subtitle = fill(strings.capture.review.suggested, {
    confidence: formatConfidence(detection.confidence),
  });
  return (
    <Card variant="dashed" className="gap-3">
      <View className="flex-row items-center gap-3">
        <NumberBadge number={number} solid={false} />
        <View className="flex-1">
          <Text className="type-title text-text">
            {formatLabel(detection.label)}
          </Text>
          <Text className="type-body-small text-text-muted">
            {hint ? `${subtitle} · ${hint}` : subtitle}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-3">
        <Button variant="secondary" className="flex-1" onPress={onReject}>
          <Text className="type-body-strong text-danger">
            {strings.capture.review.reject}
          </Text>
        </Button>
        <Button variant="dark" className="flex-1" onPress={onAccept}>
          {strings.capture.review.accept}
        </Button>
      </View>
    </Card>
  );
}

function RejectedCard({ detection, number, onUndo }: DetectionCardProps) {
  return (
    <Card variant="dashed" className="flex-row items-center gap-3">
      <NumberBadge number={number} solid={false} />
      <View className="flex-1">
        <Text className="type-title text-text-muted line-through">
          {formatLabel(detection.label)}
        </Text>
        <Text className="type-body-small text-text-muted">
          {fill(strings.capture.review.rejected, {
            confidence: formatConfidence(detection.confidence),
          })}
        </Text>
      </View>
      <Button variant="secondary" onPress={onUndo}>
        {strings.capture.review.undo}
      </Button>
    </Card>
  );
}
