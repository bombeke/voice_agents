import { useAuth } from "@/providers/AuthProvider";
import { ACCESS_CONTROL } from "@/services/auth/AccessControl";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Redirect, usePathname } from "expo-router";
import { PropsWithChildren } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export function GuardedLayout({ children }: PropsWithChildren) {
  const { loading, isAuthenticated, isAdmin, adminMode, claims } = useAuth();

  const pathname = usePathname();

  const rule = resolveRule(pathname);

  if (!rule) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (rule.requireAuth && !isAuthenticated) {
    return <Redirect href={rule.fallback ?? "/(auth)/login"} />;
  }

  if (rule.requireAdmin && !isAdmin) {
    return <Redirect href={rule.fallback ?? "/(tabs)"} />;
  }

  if (rule.permission && !hasPerm(claims as any, rule.permission)) {
    return <Redirect href={rule.fallback ?? "/(tabs)"} />;
  }

  if (adminMode === "offline-readonly" && rule.allowOfflineReadonly === false) {
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

function resolveRule(pathname: string | null) {
  if (!pathname) return null;

  const clean = pathname.replace(/^\//, "");

  // Longest match wins
  return (
    Object.entries(ACCESS_CONTROL)
      .filter(([key]) => clean.startsWith(key))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null
  );
}
