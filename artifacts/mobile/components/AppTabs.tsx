import { Icon } from "@/components/ui/Icons";
import { TabBar } from "@/components/ui/TabBar";
import { useCaptureSummary } from "@/hooks/useCaptureSummary";
import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG, MenuItem } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { Tabs } from "expo-router";
import { useMemo } from "react";

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
  "map",
  "records",
  "review",
  "settings",
  // Legacy module stacks: still reachable by URL, never shown in the bar.
  "agents",
  "poles",
  "sanitation",
  "roads",
] as const;

const renderTabBar = (props: Parameters<typeof TabBar>[0]) => (
  <TabBar {...props} />
);

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();
  const { stats } = useCaptureSummary();

  const visible = useMemo(() => {
    const menu = filterMenu(MENU_CONFIG, { isAdmin, claims, adminMode });
    return new Map<string, MenuItem>(
      menu.filter((item) => item.tab).map((item) => [item.tab!, item]),
    );
  }, [isAdmin, claims, adminMode]);

  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
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
                    tabBarIcon: ({ color, size }) => (
                      <Icon name={item.icon} color={color} size={size} />
                    ),
                    // The pending-sync badge stays visible from every tab.
                    tabBarBadge:
                      name === "records" && stats.pending > 0
                        ? stats.pending
                        : undefined,
                  }
                : { href: null }
            }
          />
        );
      })}
    </Tabs>
  );
}
