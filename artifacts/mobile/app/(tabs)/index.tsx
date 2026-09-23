import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

import { AssetCategory, CategoryColors, colors } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG, MenuItem } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";

const NATIVE_DRIVER = Platform.OS !== "web";
const AnimatedView = withUniwind(Animated.View);

const TILE_BG: Record<AssetCategory, string> = {
  energy: "bg-energy-tile",
  water: "bg-water-tile",
  telecom: "bg-telecom-tile",
  roads: "bg-roads-tile",
};

function ModuleCard({ item }: { item: MenuItem }) {
  const scale = useRef(new Animated.Value(1)).current;
  const router = useRouter();

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();

  return (
    <AnimatedView style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => router.push(item.href as any)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className="bg-surface border border-border rounded-2xl p-4 mb-2.5 flex-row items-center gap-4"
      >
        <View
          className={`w-[52px] h-[52px] rounded-button items-center justify-center ${
            item.category ? TILE_BG[item.category] : "bg-primary-soft"
          }`}
        >
          <FontAwesome
            name={item.icon}
            size={22}
            color={
              item.category
                ? CategoryColors[item.category].solid
                : colors.primary
            }
          />
        </View>

        <View className="flex-1 gap-0.5">
          <Text className="type-title text-text">{item.title}</Text>
          <Text className="type-caption text-text-muted">{item.desc}</Text>
        </View>

        <FontAwesome
          name="chevron-right"
          size={12}
          color={colors.borderStrong}
        />
      </Pressable>
    </AnimatedView>
  );
}

export default function HomeScreen() {
  const { isAdmin, claims, adminMode } = useAuth();
  const menu = useMemo(
    () => filterMenu(MENU_CONFIG, { isAdmin, claims, adminMode }),
    [isAdmin, claims, adminMode],
  );
  return (
    <ScrollView
      contentContainerClassName="p-5 pb-10"
      className="bg-background"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-7">
        <Text className="type-overline text-text-muted">BYOD Environment</Text>
        <Text className="type-display text-text mt-1">AI Toolkit</Text>
        {claims?.sub ? (
          <Text className="type-body-small text-text-muted mt-1.5">
            Welcome back,{" "}
            <Text className="font-body-semi text-text">{claims.sub}</Text>
            {isAdmin && " · Admin"}
          </Text>
        ) : null}
      </View>

      {/* Module cards */}
      <View>
        {menu
          // The Home entry is the screen we are already on - it is a tab, not a card.
          .filter((item) => item.tab !== "index")
          .map((item) => (
            <ModuleCard key={item.key} item={item} />
          ))}
      </View>
    </ScrollView>
  );
}
