import { AttributeRow } from "@/components/camera/AttributeRow";
import { Card, CardDivider } from "@/components/ui/Card";
import { strings } from "@/constants/Strings";
import {
  formatStatuses,
  splitAttributes,
  statusSource,
} from "@/helpers/recordDetail";
import type { CaptureRecord } from "@/types/Capture";
import { Fragment } from "react";
import { Text, View } from "react-native";

const d = strings.records.detail;

/** The tagging form's statuses, laid out like an AttributeRow. */
function StatusRow({
  record,
}: {
  record: Pick<CaptureRecord, "statuses" | "suggestedStatuses">;
}) {
  const value = formatStatuses(record.statuses);
  const source = statusSource(record);
  return (
    <View className="min-h-[52px] px-4 py-3 flex-row items-center gap-3">
      <Text className="w-[38%] type-body-small text-text-muted">
        {d.status}
      </Text>
      <Text
        className={`flex-1 ${value ? "type-body-strong text-text" : "type-body-small text-text-muted"}`}
      >
        {value ?? d.noStatus}
      </Text>
      <Text className="type-chip text-text-muted">
        {strings.capture.review.source[source]}
      </Text>
    </View>
  );
}

/**
 * Every attribute with where it came from ("AI · high", "GIS", "User"),
 * plus the condition statuses before the values GIS adds after sync.
 */
export function RecordAttributes({ record }: { record: CaptureRecord }) {
  const { before, after } = splitAttributes(record.attributes);
  const rows = [
    ...before.map((a) => <AttributeRow key={a.key} attribute={a} />),
    <StatusRow key="status" record={record} />,
    ...after.map((a) => <AttributeRow key={a.key} attribute={a} />),
  ];

  return (
    <View accessibilityLabel={d.attributes}>
      <Card variant="flush">
        <View className="min-h-[52px] px-4 flex-row items-center justify-between bg-surface border-b border-border">
          <Text accessibilityRole="header" className="type-title text-text">
            {d.attributes}
          </Text>
          <Text className="type-caption text-text-muted">{d.source}</Text>
        </View>
        {rows.map((row, i) => (
          <Fragment key={row.key}>
            {i > 0 ? <CardDivider /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}
