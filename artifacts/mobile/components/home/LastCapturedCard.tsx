import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { formatCaptureMeta } from "@/helpers/captureStats";
import type { CaptureSummary } from "@/types/Capture";
import { Text, View } from "react-native";

interface LastCapturedCardProps {
  capture?: CaptureSummary;
  onPress: (capture: CaptureSummary) => void;
}

/** "Last captured" section: the newest record, or a hint when there is none. */
export function LastCapturedCard({ capture, onPress }: LastCapturedCardProps) {
  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className="type-overline text-text-muted"
      >
        {strings.home.lastCaptured}
      </Text>
      {capture ? (
        <Card
          variant="flush"
          onPress={() => onPress(capture)}
          accessibilityLabel={`${capture.title}, ${formatCaptureMeta(capture)}`}
        >
          <View className="flex-row items-center gap-3 px-3 py-2.5">
            <CategoryIcon category={capture.category} size="sm" />
            <View className="flex-1 gap-0.5">
              <Text className="type-body-strong text-text" numberOfLines={1}>
                {capture.title}
              </Text>
              <Text className="type-caption text-text-muted" numberOfLines={1}>
                {formatCaptureMeta(capture)}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </View>
        </Card>
      ) : (
        <Text className="type-body-small text-text-muted">
          {strings.home.nothingYet}
        </Text>
      )}
    </View>
  );
}
