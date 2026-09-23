import { colors } from "@/constants/theme";
import { Text, View } from "react-native";
import { Icon } from "./Icons";

/** Blue informational callout (radius 12) with a leading info icon. */
export function InfoNote({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-2.5 rounded-xl bg-info-soft px-3.5 py-3">
      <Icon name="info" size={20} color={colors.onInfoSoft} />
      <Text className="flex-1 type-body-small text-on-info-soft">
        {children}
      </Text>
    </View>
  );
}
