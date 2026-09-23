import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Text, View } from "react-native";

/** Web stand-in for the native asset map. */
export function AssetMapView() {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8 bg-background">
      <Icon name="map" size={48} color={colors.textMuted} />
      <Text
        accessibilityRole="header"
        className="type-h2 text-text text-center"
      >
        {strings.map.unavailableTitle}
      </Text>
      <Text className="type-body text-text-muted text-center">
        {strings.map.unavailableMessage}
      </Text>
    </View>
  );
}
