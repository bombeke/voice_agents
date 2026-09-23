import { Text, View } from "react-native";

/** Record sync / review state, matching the local event queue states. */
export type RecordStatus =
  "synced" | "pending" | "uploading" | "failed" | "flagged" | "draft";

const STATUS: Record<RecordStatus, { label: string; bg: string; fg: string }> =
  {
    synced: {
      label: "Synced",
      bg: "bg-success-soft",
      fg: "text-on-success-soft",
    },
    pending: {
      label: "Pending",
      bg: "bg-warning-soft",
      fg: "text-on-warning-soft",
    },
    uploading: {
      label: "Uploading",
      bg: "bg-primary-soft",
      fg: "text-primary",
    },
    failed: {
      label: "Sync failed",
      bg: "bg-danger-soft",
      fg: "text-on-danger-soft",
    },
    flagged: {
      label: "Flagged",
      bg: "bg-danger-soft",
      fg: "text-on-danger-soft",
    },
    draft: { label: "Draft", bg: "bg-surface-muted", fg: "text-text-muted" },
  };

interface StatusBadgeProps {
  status: RecordStatus;
  /** Override the default label (e.g. "3 pending", a reject reason). */
  label?: string;
}

/** Compact 24 px pill shown on record rows and headers. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const s = STATUS[status];
  const text = label ?? s.label;
  return (
    <View
      className={`h-6 px-2 rounded-xl justify-center self-start ${s.bg}`}
      accessible
      accessibilityLabel={`Status: ${text}`}
    >
      <Text className={`type-chip text-xs ${s.fg}`} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
