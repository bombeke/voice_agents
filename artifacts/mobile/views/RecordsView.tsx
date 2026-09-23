import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { useCaptureSummary } from "@/hooks/useCaptureSummary";
import { Text, View } from "react-native";

/** Placeholder Records tab until the list and filters are built. */
export function RecordsView() {
  const { stats } = useCaptureSummary();
  return (
    <View className="flex-1 bg-background pt-safe-offset-6 px-5 gap-3">
      <Text accessibilityRole="header" className="type-h1 text-text">
        {strings.records.title}
      </Text>
      {stats.pending > 0 ? (
        <Text className="type-body text-text">
          {fill(strings.records.pendingSummary, { count: stats.pending })}
        </Text>
      ) : null}
      <InfoNote>{strings.records.comingSoon}</InfoNote>
    </View>
  );
}
