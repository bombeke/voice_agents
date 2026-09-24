import { Icon } from "@/components/ui/Icons";
import { TabBar } from "@/components/ui/TabBar";
import { useCaptureSummary } from "@/hooks/useCaptureSummary";
import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG, MenuItem } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { reviewQueue$ } from "@/services/storage/ReviewStore";
import { useSelector } from "@legendapp/state/react";
import {
  getFocusedRouteNameFromRoute,
  type RouteProp,
} from "@react-navigation/native";
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

/**
 * Full-screen routes inside a tab's stack: the tab bar hides there, as the
 * record detail has its own bottom actions.
 */
const FULL_SCREEN_ROUTES = new Set(["[id]"]);

const tabBarStyle = (route: RouteProp<Record<string, object | undefined>>) =>
  FULL_SCREEN_ROUTES.has(getFocusedRouteNameFromRoute(route) ?? "")
    ? ({ display: "none" } as const)
    : undefined;

const badge = (tab: string, pending: number, toReview: number) => {
  const count = tab === "records" ? pending : tab === "review" ? toReview : 0;
  return count > 0 ? count : undefined;
};

const renderTabBar = (props: Parameters<typeof TabBar>[0]) => (
  <TabBar {...props} />
);

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();
  const { stats } = useCaptureSummary();
  const reviewCount = useSelector(() => reviewQueue$.get().length);

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
            options={({ route }) =>
              item
                ? {
                    title: item.title,
                    tabBarStyle: tabBarStyle(route),
                    tabBarIcon: ({ color, size }) => (
                      <Icon name={item.icon} color={color} size={size} />
                    ),
                    // The pending-sync badge stays visible from every tab,
                    // as does the supervisor's queue.
                    tabBarBadge: badge(name, stats.pending, reviewCount),
                  }
                : { href: null }
            }
          />
        );
      })}
    </Tabs>
  );
}
