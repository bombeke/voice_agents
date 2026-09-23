import { strings } from "@/constants/Strings";
import type { TodayStats } from "@/helpers/captureStats";
import type { GnssStatus } from "@/types/Capture";
import { Text, View } from "react-native";

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <View
      className="gap-0.5"
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text className="type-caption text-text-muted">{label}</Text>
      <Text className={`type-stat ${danger ? "text-danger" : "text-text"}`}>
        {value}
      </Text>
    </View>
  );
}

const Divider = () => <View className="w-px h-9 bg-border" />;

interface TodayStatsCardProps {
  stats: TodayStats;
  gnss: GnssStatus | null;
}

/** "Today" strip: captured / synced / flagged counts and the GNSS state. */
export function TodayStatsCard({ stats, gnss }: TodayStatsCardProps) {
  const gnssOk = gnss?.ok ?? false;
  const gnssLabel = gnss?.bands ?? strings.home.gnssNoFix;
  return (
    <View
      accessibilityLabel={strings.home.todayLabel}
      className="flex-row items-center justify-between px-4 py-3.5 bg-surface border border-border rounded-button"
    >
      <Stat label={strings.home.capturedToday} value={stats.capturedToday} />
      <Divider />
      <Stat label={strings.home.synced} value={stats.synced} />
      <Divider />
      <Stat
        label={strings.home.flagged}
        value={stats.flagged}
        danger={stats.flagged > 0}
      />
      <Divider />
      <View
        className="gap-1"
        accessible
        accessibilityLabel={`${strings.home.gnss}: ${gnssLabel}`}
      >
        <Text className="type-caption text-text-muted">
          {strings.home.gnss}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View
            className={`w-2 h-2 rounded-full ${gnssOk ? "bg-success" : "bg-warning"}`}
          />
          <Text
            className={`type-chip text-[13px] ${gnssOk ? "text-success" : "text-warning"}`}
          >
            {gnssLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
