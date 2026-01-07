import { FontAwesome } from "@expo/vector-icons";
import { TabList, TabTrigger } from "expo-router/ui";

import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { Text, View } from "react-native";

export default function AppTabs() {
  const { isAdmin, adminMode, claims } = useAuth();

  const isOfflineReadonly = adminMode === "offline-readonly";

  return (
      <TabList className="flex-row bg-black border-t border-neutral-800">

        {/* Home (always visible) */}
        <TabTrigger name="index" className="flex-1 items-center py-3">
          <FontAwesome name="home" size={18} />
          Home
        </TabTrigger>

        {/* Agents (permission based) */}
        {hasPerm(claims as any, "agents:view") && (
          <TabTrigger name="agents" className="flex-1 items-center py-3">
            <FontAwesome name="user" size={18} />
            AI Agents
          </TabTrigger>
        )}

        {/* Core AI tabs */}
        <TabTrigger name="poles" className="flex-1 items-center py-3">
          <FontAwesome name="camera" size={18} />
          AI Poles
        </TabTrigger>

        <TabTrigger name="sanitation" className="flex-1 items-center py-3">
          <FontAwesome name="recycle" size={18} />
          AI Sanitation
        </TabTrigger>

        <TabTrigger name="roads" className="flex-1 items-center py-3">
          <FontAwesome name="road" size={18} />
          AI Roads
        </TabTrigger>

        {/* Admin tabs */}
        {isAdmin && hasPerm(claims as any, "admin:read") && (
          <>
            <TabTrigger
              name={Routes.ADMIN.DASHBOARD.pathname.slice(1)}
              className="flex-1 items-center py-3"
              asChild
            > 
              <View className="relative items-center">
                <FontAwesome name="shield" size={18} />
                <Text>Admin</Text>

                {isOfflineReadonly && (
                  <View className="absolute -top-1 -right-3 bg-red-600 px-1.5 rounded-full">
                    <Text className="text-white text-[10px]">OFF</Text>
                  </View>
                )}
              </View>
              
            </TabTrigger>

            <TabTrigger name="users" className="flex-1 items-center py-3">
              <FontAwesome name="users" size={18} />
              Users
            </TabTrigger>

            <TabTrigger name="policies" className="flex-1 items-center py-3">
              <FontAwesome name="file-text" size={18} />
              Policies
            </TabTrigger>
          </>
        )}

        {/* Offline-only */}
        {isOfflineReadonly && (
          <TabTrigger name="offline" className="flex-1 items-center py-3">
            <FontAwesome name="wifi" size={18} />
            Offline
          </TabTrigger>
        )}

        {/* Settings */}
        <TabTrigger name="settings" className="flex-1 items-center py-3">
          <FontAwesome name="cog" size={18} />
          Settings
        </TabTrigger>
      </TabList>
  );
}
