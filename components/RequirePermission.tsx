import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Redirect } from "expo-router";
import { PropsWithChildren } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Props = PropsWithChildren<{
  permission: string;
  fallback?: string;
  allowOfflineReadonly?: boolean;
}>;

export function RequirePermission({
  permission,
  fallback = "/(tabs)",
  allowOfflineReadonly = false,
  children,
}: Props) {
  const { loading, isAuthenticated, claims, adminMode } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const permitted = hasPerm(claims as any, permission);

  if (!permitted) {
    return <Redirect href={fallback as any} />;
  }

  if (adminMode === "offline-readonly" && !allowOfflineReadonly) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-center text-gray-600">
          This feature is unavailable in offline mode.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
