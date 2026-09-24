import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import {
  formatBytes,
  type StorageBreakdown,
  type StorageKind,
} from "@/helpers/settings";
import { Text, View } from "react-native";

const st = strings.settings.storage;

/** Swatch colour and legend label per kind; written out for Tailwind's scanner. */
const KINDS: Record<StorageKind, { swatch: string; label: string }> = {
  photos: { swatch: "bg-primary", label: st.photos },
  map: { swatch: "bg-accent", label: st.map },
  model: { swatch: "bg-water", label: st.model },
};

interface StorageCardProps {
  breakdown: StorageBreakdown;
  /** Photos already on the server; the clear button is disabled at 0. */
  clearableBytes: number;
  onClear: () => void;
}

/** App data total, a stacked bar by kind, and "Clear photos already synced". */
export function StorageCard({
  breakdown,
  clearableBytes,
  onClear,
}: StorageCardProps) {
  const { totalBytes, segments } = breakdown;
  const sizes = Object.fromEntries(
    segments.map((s) => [s.kind, formatBytes(s.bytes)]),
  ) as Record<StorageKind, string>;

  return (
    <Card className="gap-2.5">
      <View className="flex-row justify-between">
        <Text className="type-body-small text-text">{st.appData}</Text>
        <Text className="type-mono text-text">{formatBytes(totalBytes)}</Text>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={fill(st.usageLabel, sizes)}
        className="h-2.5 rounded-[5px] bg-surface-muted flex-row overflow-hidden"
      >
        {segments.map(({ kind, share }) => (
          // Widths are computed, so they stay in `style`.
          <View
            key={kind}
            className={KINDS[kind].swatch}
            style={{ width: `${share * 100}%` }}
          />
        ))}
      </View>

      <View
        className="flex-row flex-wrap gap-x-3.5 gap-y-1"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {segments.map(({ kind }) => (
          <View key={kind} className="flex-row items-center gap-1.5">
            <View className={`w-2 h-2 rounded-xs ${KINDS[kind].swatch}`} />
            <Text className="type-caption text-text-muted">
              {fill(KINDS[kind].label, { size: sizes[kind] })}
            </Text>
          </View>
        ))}
      </View>

      <Button
        variant="secondary"
        disabled={clearableBytes <= 0}
        onPress={onClear}
      >
        {st.clearSynced}
      </Button>
    </Card>
  );
}
