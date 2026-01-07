import { FontAwesome } from "@expo/vector-icons";

import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";

export default function AppTabs() {
  const { isAdmin, adminMode, claims } = useAuth();

  const isOfflineReadonly = adminMode === "offline-readonly";

  return (
    <>
        {/* Home (always visible) */}
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () =>
          <FontAwesome name="home" size={18} />
        }}
        />

        {/* Agents (permission based) */}
        {hasPerm(claims as any, "agents:view") && (
          <Tabs.Screen name="agents" options={{ title: "Agents", tabBarIcon: () =>
            <FontAwesome name="user" size={18} />
          }}
          />
        )}

        {/* Core AI tabs */}
        <Tabs.Screen name="poles" options={{ title: "Poles", tabBarIcon: () =>
          <FontAwesome name="camera" size={18} />
        }}
        />

        <Tabs.Screen name="sanitation"  options={{ title: "Sanitation", tabBarIcon: () =>
          <FontAwesome name="recycle" size={18} />
        }}
        />

        <Tabs.Screen name="roads" options={{ title: "Roads", tabBarIcon: () =>
          <FontAwesome name="road" size={18} />
        }}
        />

        {/* Admin tabs */}
        {isAdmin && hasPerm(claims as any, "admin:read") && (
          <>
            <Tabs.Screen
              name={Routes.ADMIN.DASHBOARD.pathname.slice(1)}
              options={{ title: "Admin", tabBarIcon: () =>(
                <View className="relative items-center">
                  <FontAwesome name="shield" size={18} />
                  <Text>Admin</Text>

                  {isOfflineReadonly && (
                    <View className="absolute -top-1 -right-3 bg-red-600 px-1.5 rounded-full">
                      <Text className="text-white text-[10px]">OFF</Text>
                    </View>
                  )}
                </View>
              )}}
            />

            <Tabs.Screen name="users"  options={{ title: "Users", tabBarIcon: () =>
              <FontAwesome name="users" size={18} />
            }}
            />

            <Tabs.Screen name="policies" options={{ title: "Policies", tabBarIcon: () =>
              <FontAwesome name="file-text" size={18} />
            }}
            />
          </>
        )}

        {/* Offline-only */}
        {isOfflineReadonly && (
          <Tabs.Screen 
            name="offline" 
            options={{ title: "Offline", tabBarIcon: () =>
            <FontAwesome name="wifi" size={18} /> 
          }}
          />
        )}

        {/* Settings */}
        <Tabs.Screen 
          name="settings" 
          options={{ title: "Settings", tabBarIcon: () =>
          <FontAwesome name="cog" size={18} />
        }}
        />
    </>
  );
}
