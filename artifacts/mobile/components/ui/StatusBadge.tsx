import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { Text, View } from "react-native";

/** Record sync / review state, matching the local event queue states. */
export type RecordStatus =
  "synced" | "pending" | "uploading" | "failed" | "flagged" | "draft";

const TONE: Record<RecordStatus, { bg: string; fg: string }> = {
  synced: { bg: "bg-success-soft", fg: "text-on-success-soft" },
  pending: { bg: "bg-warning-soft", fg: "text-on-warning-soft" },
  uploading: { bg: "bg-primary-soft", fg: "text-primary" },
  failed: { bg: "bg-danger-soft", fg: "text-on-danger-soft" },
  flagged: { bg: "bg-danger-soft", fg: "text-on-danger-soft" },
  draft: { bg: "bg-surface-muted", fg: "text-text-muted" },
};

interface StatusBadgeProps {
  status: RecordStatus;
  /** Override the default label (e.g. "3 pending", a reject reason). */
  label?: string;
}

/** Compact 24 px pill shown on record rows and headers. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = TONE[status];
  const text = label ?? strings.recordStatus[status];
  return (
    <View
      className={`h-6 px-2 rounded-xl justify-center self-start ${tone.bg}`}
      accessible
      accessibilityLabel={fill(strings.recordStatus.label, { status: text })}
    >
      <Text className={`type-chip text-xs ${tone.fg}`} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
