import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

interface SyncBannerProps {
  /** Records not yet uploaded, failed and uploading included. */
  pending: number;
  failed: number;
  online: boolean;
  syncing: boolean;
  onSync: () => void;
}

/** Dark "{n} records waiting to upload" card with "Sync now"; hidden once all is synced. */
export function SyncBanner({
  pending,
  failed,
  online,
  syncing,
  onSync,
}: SyncBannerProps) {
  if (pending === 0) return null;
  const b = strings.records.banner;
  const title = syncing
    ? b.uploading
    : pending === 1
      ? b.waitingOne
      : fill(b.waiting, { count: pending });
  const subline =
    failed > 0 && !syncing
      ? fill(b.failed, { count: failed })
      : online
        ? b.online
        : b.offline;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={b.label}
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-text"
    >
      {syncing ? (
        <ActivityIndicator colorClassName="accent-accent" />
      ) : (
        <Icon name="sync" size={24} color={colors.accent} />
      )}
      <View className="flex-1 gap-0.5">
        <Text className="type-body-strong text-surface">{title}</Text>
        <Text className="type-caption text-on-camera-muted">{subline}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: syncing, busy: syncing }}
        disabled={syncing}
        onPress={onSync}
        className="h-11 px-3.5 items-center justify-center rounded-xl bg-surface active:bg-surface-muted disabled:opacity-60"
      >
        <Text className="type-body-strong text-text">{b.syncNow}</Text>
      </Pressable>
    </View>
  );
}
