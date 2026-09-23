import { AttributeRow } from "@/components/camera/AttributeRow";
import { Card, CardDivider } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { formatDate, formatLastSeen } from "@/helpers/mapAssets";
import type { MapAsset } from "@/types/Map";
import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";

const p = strings.map.profile;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text
        accessibilityRole="header"
        className="type-overline text-text-muted"
      >
        {title}
      </Text>
      <Card variant="flush">{children}</Card>
    </View>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <View className="min-h-11 px-4 py-2.5 flex-row items-center gap-3">
      <Text className="w-[38%] type-body-small text-text-muted">{label}</Text>
      <View className="flex-1">
        {typeof value === "string" ? (
          <Text
            className={
              mono ? "type-mono text-text" : "type-body-strong text-text"
            }
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

/** Rows separated by dividers; skips nulls so optional rows drop out cleanly. */
function Rows({ children }: { children: (ReactNode | null)[] }) {
  const rows = children.filter(Boolean);
  return rows.map((row, i) => (
    <Fragment key={i}>
      {i > 0 ? <CardDivider /> : null}
      {row}
    </Fragment>
  ));
}

/**
 * The asset profile: every attribute with its source and confidence
 * ("AI · high", "GIS", "User"), where it is, and the record's history.
 */
export function AssetProfile({ asset }: { asset: MapAsset }) {
  const functional = strings.capture.tag.functionalOptions[asset.functional];

  return (
    <View className="gap-3">
      {asset.attributes.length > 0 ? (
        <Section title={p.attributes}>
          <Rows>
            {asset.attributes.map((attribute) => (
              <AttributeRow key={attribute.key} attribute={attribute} />
            ))}
          </Rows>
        </Section>
      ) : null}

      <Section title={p.location}>
        <Rows>
          {[
            <Row
              key="coords"
              label={p.coordinates}
              value={`${asset.latitude.toFixed(6)}, ${asset.longitude.toFixed(6)}`}
              mono
            />,
            <Row
              key="accuracy"
              label={p.accuracy}
              value={fill(p.accuracyValue, {
                value: asset.accuracyM.toFixed(1),
              })}
              mono
            />,
            <Row
              key="elevation"
              label={p.elevation}
              value={
                asset.altitude === null
                  ? p.notReported
                  : fill(p.elevationValue, {
                      value: Math.round(asset.altitude),
                    })
              }
              mono
            />,
          ]}
        </Rows>
      </Section>

      <Section title={p.record}>
        <Rows>
          {[
            <Row key="functional" label={p.functional} value={functional} />,
            <Row
              key="first"
              label={p.firstRecorded}
              value={formatDate(asset.firstRecordedAt)}
            />,
            <Row
              key="last"
              label={p.lastSeen}
              value={formatLastSeen(asset.lastSeenAt)}
            />,
            <Row key="by" label={p.capturedBy} value={asset.capturedBy} />,
            <Row
              key="photos"
              label={p.photos}
              value={String(asset.photoCount)}
            />,
            <Row
              key="sync"
              label={p.sync}
              value={
                <View className="flex-row flex-wrap gap-1.5">
                  <StatusBadge status={asset.syncStatus} />
                  {asset.flagged ? (
                    <StatusBadge status="flagged" label={p.flagged} />
                  ) : null}
                </View>
              }
            />,
            asset.comment ? (
              <Row key="comment" label={p.comment} value={asset.comment} />
            ) : null,
          ]}
        </Rows>
      </Section>
    </View>
  );
}
