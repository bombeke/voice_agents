import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { Tabs } from "expo-router";
import { cloneElement, useMemo } from "react";
import { Platform } from "react-native";
import { HapticTab } from "./HapticTab";

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();

  const menu = useMemo(
    () => filterMenu(MENU_CONFIG, { isAdmin, claims, adminMode }),
    [isAdmin, claims, adminMode],
  );

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
          height: Platform.OS === "ios" ? 80 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      {menu.map((item: any) => (
        <Tabs.Screen
          key={item.key}
          name={item.route.replace(/^\//, "")}
          options={{
            title: item.title,
            tabBarIcon: ({ color }: { color: string }) =>
              cloneElement(item.icon as React.ReactElement<any>, { color }),
          }}
        />
      ))}
    </Tabs>
  );
}
