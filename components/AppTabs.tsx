import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function AppTabs() {
  const { isAdmin, adminMode, claims } = useAuth();

  const isOfflineReadonly = adminMode === "offline-readonly";

  return (
    <Tabs screenOptions={{ headerShown: false }}>
        {/* Always visible */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: () => <FontAwesome name="home" size={18} />,
          }}
        />
        {hasPerm(claims as any, "agents:view") && (
          <Tabs.Screen
            name="agents"
            options={{
              title: "AI Agents",
              tabBarIcon: () => <FontAwesome name="user" size={18} />,
            }}
          />
        )}
        <Tabs.Screen
          name="poles"
          options={{
            title: "AI Poles",
            tabBarIcon: () => <FontAwesome name="camera" size={18} />,
          }}
        />
        <Tabs.Screen
          name="sanitation"
          options={{
            title: "AI Sanitation",
            tabBarIcon: () => <FontAwesome name="recycle" size={18} />,
          }}
        />
        <Tabs.Screen
          name="roads"
          options={{
            title: "AI Roads",
            tabBarIcon: () => <FontAwesome name="road" size={18} />,
          }}
        />

      {/* Admin tabs (permission & offline aware) */}
      {isAdmin && hasPerm(claims as any, "admin:read") && (
        <>
        <Tabs.Screen
          name={Routes.ADMIN.DASHBOARD.pathname.slice(1)} // remove leading slash
          options={{
            title: "Admin",
            tabBarBadge: isOfflineReadonly ? "OFF" : undefined,
          }}
        />
        <Tabs.Screen name="users" options={{ title: "Users" }} />
        <Tabs.Screen name="policies" options={{ title: "Policies" }} />
        </>
      )}

      {isOfflineReadonly && (
        <Tabs.Screen
          name="offline"
          options={{ title: "Offline Mode" }}
        />
      )}

      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
