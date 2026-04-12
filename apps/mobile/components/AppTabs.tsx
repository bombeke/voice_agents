import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { Tabs } from "expo-router";
import { useMemo } from "react";

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();

  const menu = useMemo(
    () =>
      filterMenu(MENU_CONFIG, {
        isAdmin,
        claims,
        adminMode,
      }),
    [isAdmin, claims, adminMode],
  );
  console.log("TAB ROUTE:");
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {menu.map((item: any) =>{
        console.log("TAB ROUTE:", item.route);
        console.log("TAB NAME:", item.route.replace("/(tabs)/", ""));
        console.log("TAB NAME1:", item.route.replace("/^\//", ""));
        return (
        <Tabs.Screen
          key={item.key}
          name={item.route.replace("/^\//", "")}
          options={{
            title: item.title,
            tabBarIcon: () => item.icon,
          }}
        />
      )})}
    </Tabs>
  );
}
