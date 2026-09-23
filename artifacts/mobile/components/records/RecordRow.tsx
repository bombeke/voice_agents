import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { formatRecordMeta, recordBadge } from "@/helpers/records";
import type { CaptureSummary } from "@/types/Capture";
import { Pressable, Text, View } from "react-native";

interface RecordRowProps {
  record: CaptureSummary;
  /** Briefly tinted when opened from another tab (e.g. the Map's "View record"). */
  highlighted?: boolean;
  /** Leave out until there is a record detail screen, so the row isn't a dead button. */
  onPress?: (record: CaptureSummary) => void;
}

/** One record: category icon, name, "10:14 · ±2.8 m · detail" and its status. */
export function RecordRow({ record, highlighted, onPress }: RecordRowProps) {
  const status = recordBadge(record);
  const meta = formatRecordMeta(record);
  const label = fill(strings.records.rowLabel, {
    title: record.title,
    meta,
    status: strings.recordStatus[status],
  });
  const className = `min-h-16 flex-row items-center gap-3 px-3.5 py-2.5 ${
    highlighted ? "bg-primary-soft" : ""
  }`;

  const content = (
    <>
      <CategoryIcon category={record.category} size="md" />
      <View className="flex-1 gap-0.5">
        <Text className="type-body-strong text-text" numberOfLines={1}>
          {record.title}
        </Text>
        <Text className="type-caption text-text-muted" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View className="self-center">
        <StatusBadge status={status} />
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} className={className}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(record)}
      className={`${className} active:bg-surface-muted`}
    >
      {content}
    </Pressable>
  );
}
