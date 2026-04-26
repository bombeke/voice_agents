import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { FontAwesome } from "@expo/vector-icons";
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
  if (menu.length === 0) {
    return (
       <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: () => (<FontAwesome name="home" size={18} />),
          }}
        />
    </Tabs>
    )
  }
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {menu.map((item: any) =>{
        return (
        <Tabs.Screen
          key={item.key}
          //name={item.route.replace(/^\//, "")}
          name={item.key }
          options={{
            title: item.title,
            tabBarIcon: () => item.icon,
          }}
        />
      )})}
    </Tabs>
  );
}
