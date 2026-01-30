import { useAuth } from "@/providers/AuthProvider";
import { MENU_CONFIG } from "@/services/auth/MenuConfig";
import { filterMenu } from "@/services/auth/MenuFilter";
import { Tabs } from "expo-router";

export default function AppTabs() {
  const { isAdmin, claims, adminMode } = useAuth();

  const menu = filterMenu(MENU_CONFIG, {
    isAdmin,
    claims,
    adminMode,
  });

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {menu.map((item: any) => (
        <Tabs.Screen
          key={item.key}
          name={item.route.replace(/^\//, "")}
          options={{
            title: item.title,
            tabBarIcon: () => item.icon,
          }}
        />
      ))}
    </Tabs>
  );
}
