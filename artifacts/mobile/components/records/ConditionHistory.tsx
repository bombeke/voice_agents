import { strings } from "@/constants/Strings";
import type { HistoryEntry } from "@/helpers/recordDetail";
import { Text, View } from "react-native";

/**
 * The asset's captures as a timeline, newest first. The filled dot is this
 * record; a rail joins it to the older ones.
 */
export function ConditionHistory({ entries }: { entries: HistoryEntry[] }) {
  return (
    <View className="gap-2.5">
      <Text accessibilityRole="header" className="type-title text-text">
        {strings.records.detail.history}
      </Text>
      <View>
        {entries.map((entry, i) => (
          <View
            key={entry.id}
            accessible
            accessibilityLabel={`${entry.title}, ${entry.summary}`}
            className="flex-row gap-3"
          >
            <View className="w-4 items-center">
              <View
                className={`mt-1 w-3.5 h-3.5 rounded-full border-2 ${
                  entry.current
                    ? "bg-primary border-primary"
                    : "bg-background border-border-strong"
                }`}
              />
              {i < entries.length - 1 ? (
                <View className="flex-1 w-0.5 bg-border-strong" />
              ) : null}
            </View>
            <View className="flex-1 gap-0.5 pb-4">
              <Text
                className={`type-body-strong ${entry.current ? "text-text" : "text-text-muted"}`}
              >
                {entry.title}
              </Text>
              <Text className="type-body-small text-text-muted">
                {entry.summary}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
