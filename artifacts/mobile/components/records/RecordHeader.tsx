import { Chip, type ChipTone } from "@/components/ui/Chip";
import { strings } from "@/constants/Strings";
import { formatCapturedLine } from "@/helpers/recordDetail";
import type { CaptureRecord, CaptureSyncStatus } from "@/types/Capture";
import { Text, View } from "react-native";

const d = strings.records.detail;

const SYNC_TONE: Record<CaptureSyncStatus, ChipTone> = {
  pending: "warning",
  uploading: "primary",
  synced: "success",
  failed: "danger",
};

interface RecordHeaderProps {
  record: Pick<CaptureRecord, "category" | "title" | "assetId" | "capturedAt">;
  syncStatus: CaptureSyncStatus;
  flagged: boolean;
}

/** Category and sync chips, the asset name, and "EP-00412 · captured …". */
export function RecordHeader({
  record,
  syncStatus,
  flagged,
}: RecordHeaderProps) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={strings.categories[record.category].label}
          tone={record.category}
        />
        <Chip label={d.sync[syncStatus]} tone={SYNC_TONE[syncStatus]} />
        {flagged ? <Chip label={d.flagged} tone="danger" /> : null}
      </View>
      <Text accessibilityRole="header" className="type-h1 text-text">
        {record.title}
      </Text>
      <Text className="type-mono text-text-muted">
        {formatCapturedLine(record)}
      </Text>
    </View>
  );
}
