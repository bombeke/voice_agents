import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Text, View } from "react-native";

/** Dark pill telling the surveyor the basemap comes from cached tiles. */
export function OfflineTilesBadge() {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={strings.map.offline}
      className="self-start h-7 px-2.5 rounded-full bg-text/80 flex-row items-center gap-1.5"
    >
      <Icon name="wifi-off" size={14} color={colors.surface} />
      <Text className="type-chip text-xs text-surface">
        {strings.map.offline}
      </Text>
    </View>
  );
}
