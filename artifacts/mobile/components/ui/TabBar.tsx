import { colors, sizes } from "@/constants/theme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, IconName } from "./Icons";

/**
 * Bottom tab bar from the Home/Main mockup: white bar, top border, active tab
 * gets a 56×30 soft-teal pill behind its icon.
 *
 * Usage: <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
 * and give each screen `tabBarIcon: tabIcon('capture')`.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      // Content (8 + 49 + 8) gives the 64 px bar above the bottom inset.
      className="flex-row justify-around items-center pt-2 px-3 pb-safe-offset-2 bg-surface border-t border-border"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        // expo-router turns `href: null` into `display: 'none'`.
        const itemStyle = StyleSheet.flatten(options.tabBarItemStyle);
        if (itemStyle?.display === "none") return null;

        const focused = state.index === index;
        const color = focused ? colors.primary : colors.textMuted;
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);

        const onPress = () => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented)
            navigation.navigate(route.name, route.params);
        };

        const onLongPress = () =>
          navigation.emit({ type: "tabLongPress", target: route.key });

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            className="w-[76px] min-h-11 items-center gap-[3px]"
          >
            <View
              className={`w-14 h-[30px] rounded-full items-center justify-center ${
                focused ? "bg-primary-soft" : ""
              }`}
            >
              {options.tabBarIcon?.({ focused, color, size: sizes.iconTab })}
              {options.tabBarBadge != null ? (
                <View className="absolute -top-0.5 right-2 min-w-[18px] h-[18px] px-[5px] rounded-full bg-accent items-center justify-center">
                  <Text className="type-tab text-[11px] leading-[14px] text-on-accent">
                    {options.tabBarBadge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              className={`type-tab ${focused ? "text-primary" : "text-text-muted"}`}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `tabBarIcon` factory using the design's tab glyphs. */
export function tabIcon(
  name: Extract<IconName, "capture" | "map" | "records" | "review">,
) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Icon name={name} color={color} size={size} />;
  };
}
