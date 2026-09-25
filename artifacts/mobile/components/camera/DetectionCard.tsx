import { AttributeRow } from "@/components/camera/AttributeRow";
import { ComputedPosition } from "@/components/camera/ComputedPosition";
import { Button } from "@/components/ui/Button";
import { Card, CardDivider } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icons";
import { InfoNote } from "@/components/ui/InfoNote";
import { AR_RELIABLE_RANGE_M } from "@/constants/Capture";
import { categoryForLabel } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import { CategoryColors, colors } from "@/constants/theme";
import {
  formatConfidence,
  formatLabel,
  suggestionHint,
} from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import type {
  AttributeKey,
  CaptureMetadata,
  ReviewDetection,
} from "@/types/Capture";
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
  /** Metadata of the photo it was detected in (lens, AR pose, phone fix). */
  metadata?: CaptureMetadata;
  /** "Re-place by tapping the base"; left out when the photo has no AR or sensor pose. */
  onReplace?: () => void;
}

/** "Confidence 0.91 · 12.4 m away", or "Placed by tap · 12.4 m away". */
export function acceptedSubtitle(detection: ReviewDetection): string {
  const r = strings.capture.review;
  const lead = detection.manual
    ? r.placedByTap
    : fill(r.confidence, {
        confidence: formatConfidence(detection.confidence),
      });
  const position = detection.position;
  return position && position.source !== "device"
    ? `${lead} · ${fill(r.away, { distance: position.distanceM.toFixed(1) })}`
    : lead;
}

/** The asset dot's colour: its category's, else the primary colour. */
function assetColor(label: string): string {
  const category = categoryForLabel(label);
  return category ? CategoryColors[category].solid : colors.primary;
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
  metadata,
  onReplace,
}: DetectionCardProps) {
  const label = formatLabel(detection.label);
  const { position } = detection;
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
            {acceptedSubtitle(detection)}
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
      {expanded && position ? (
        <>
          <CardDivider />
          <ComputedPosition
            label={detection.label.replace(/[_-]/g, " ")}
            position={position}
            metadata={metadata}
            color={assetColor(detection.label)}
            onReplace={onReplace}
          />
        </>
      ) : null}
      {expanded && detection.attributes.length ? (
        <>
          <CardDivider />
          <Text className="px-4 pt-4 pb-1 type-overline text-text-muted">
            {strings.capture.review.attributes}
          </Text>
          {detection.attributes.map((attribute, i) => (
            <Fragment key={attribute.key}>
              {i > 0 ? <CardDivider /> : null}
              <AttributeRow
                attribute={attribute}
                onEdit={() => onEditAttribute(attribute.key)}
              />
            </Fragment>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function SuggestedCard({
  detection,
  number,
  onAccept,
  onReject,
}: DetectionCardProps) {
  const r = strings.capture.review;
  const { position } = detection;
  const distant =
    !!position &&
    position.source !== "device" &&
    position.distanceM > AR_RELIABLE_RANGE_M;
  const confidence = formatConfidence(detection.confidence);
  const hint = suggestionHint(detection);
  const label = formatLabel(detection.label);
  const subtitle = distant
    ? `${fill(r.suggestedShort, { confidence })} · ${fill(r.aboutAway, {
        distance: Math.round(position.distanceM),
      })}`
    : [fill(r.suggested, { confidence }), hint].filter(Boolean).join(" · ");
  return (
    <Card variant="dashed" className="gap-3">
      <View className="flex-row items-center gap-3">
        <NumberBadge number={number} solid={false} />
        <View className="flex-1">
          <Text className="type-title text-text">
            {distant ? fill(r.distantTitle, { label }) : label}
          </Text>
          <Text className="type-body-small text-text-muted">{subtitle}</Text>
        </View>
      </View>
      {distant ? (
        <InfoNote tone="warning">
          {fill(r.beyondRange, { range: AR_RELIABLE_RANGE_M })}
        </InfoNote>
      ) : null}
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
