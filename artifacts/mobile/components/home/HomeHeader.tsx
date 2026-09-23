import { AppLogo } from "@/components/auth/AppLogo";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { Pressable, Text, View } from "react-native";

interface HomeHeaderProps {
  org?: string;
  pendingCount: number;
  onPendingPress: () => void;
  onProfilePress: () => void;
}

/** Logo + project overline + title, with the sync pill and profile button. */
export function HomeHeader({
  org,
  pendingCount,
  onPendingPress,
  onProfilePress,
}: HomeHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="flex-1 flex-row items-center gap-2.5">
        <AppLogo size={36} />
        <View className="flex-1 gap-0.5">
          <Text className="type-overline text-text-muted" numberOfLines={1}>
            {org
              ? fill(strings.home.overline, { org })
              : strings.home.overlineNoOrg}
          </Text>
          <Text
            accessibilityRole="header"
            className="type-h2 text-text"
            numberOfLines={1}
          >
            {strings.home.title}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {pendingCount > 0 ? (
          <Pressable
            onPress={onPendingPress}
            accessibilityRole="button"
            accessibilityLabel={fill(strings.home.pendingLabel, {
              count: pendingCount,
            })}
            hitSlop={4}
            className="h-9 px-3 rounded-full flex-row items-center gap-1.5 bg-warning-soft active:opacity-85"
          >
            <Icon name="sync" size={16} color={colors.onWarningSoft} />
            <Text className="type-chip text-[13px] text-on-warning-soft">
              {fill(strings.home.pending, { count: pendingCount })}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onProfilePress}
          accessibilityRole="button"
          accessibilityLabel={strings.home.profileLabel}
          className="w-11 h-11 rounded-full items-center justify-center bg-surface border border-border active:bg-surface-muted"
        >
          <Icon name="user" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
