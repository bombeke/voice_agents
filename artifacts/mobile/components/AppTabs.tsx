import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG, MenuItem } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "./HapticTab";

/**
 * Every route that exists under `app/(tabs)`.
 *
 * Expo Router auto-appends any file-system route that is not declared here, so
 * the list has to be complete: a route we leave out would still show up as a
 * tab even when the menu filter decided to hide it. Hidden entries get
 * `href: null`, which is how expo-router removes a tab from the bar.
 */
const TAB_ROUTES = [
  "index",
  "agents",
  "poles",
  "sanitation",
  "roads",
  "settings",
] as const;

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();
  const insets = useSafeAreaInsets();

  const visible = useMemo(() => {
    const menu = filterMenu(MENU_CONFIG, { isAdmin, claims, adminMode });
    return new Map<string, MenuItem>(
      menu.filter((item) => item.tab).map((item) => [item.tab!, item]),
    );
  }, [isAdmin, claims, adminMode]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          // Android is edge-to-edge from SDK 54 on, so the bar is drawn behind
          // the system navigation bar. Without the inset the buttons sit under
          // it and taps never reach the app.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      {TAB_ROUTES.map((name) => {
        const item = visible.get(name);

        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={
              item
                ? {
                    title: item.title,
                    tabBarIcon: ({ color }: { color: string }) => (
                      <FontAwesome name={item.icon} size={18} color={color} />
                    ),
                  }
                : { href: null }
            }
          />
        );
      })}
    </Tabs>
  );
}
