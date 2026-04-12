import { useAuth } from "@/providers/AuthProvider";
import { ACCESS_CONTROL } from "@/services/auth/AccessControl";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { usePathname, useRouter } from "expo-router";
import { PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export function GuardedLayout({ children }: PropsWithChildren) {
  const { loading, isAuthenticated, isAdmin, adminMode, claims } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const rule = resolveRule(pathname);

 useEffect(() => {
  if (!rule) return;
  if (loading) return;

  // Wait until claims are ready if authenticated
  if (isAuthenticated && !claims) return;

  // Not authenticated
  if (rule.requireAuth && !isAuthenticated) {
    router.replace(rule.fallback ?? Routes.LOGIN as any);
    return;
  }

  // Admin check
  if (rule.requireAdmin && !isAdmin) {
    router.replace(rule.fallback ?? Routes.TABS as any);
    return;
  }

  // Permission check
  if (rule.permission && !hasPerm(claims as any, rule.permission)) {
    router.replace(rule.fallback ?? Routes.TABS as any);
    return;
  }

}, [rule, loading, isAuthenticated, isAdmin, claims]);


if (loading || (isAuthenticated && !claims)) {
  console.log("5")
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}



  // Offline read-only message
  if (
    rule &&
    adminMode === "offline-readonly" &&
    rule.allowOfflineReadonly === false
  ) {
    console.log("6")
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-center text-gray-600">
          This feature is unavailable in offline mode.
        </Text>
      </View>
    );
  }

  console.log("Rule:",rule, "loading:",loading, "auth:",isAuthenticated, "isadmin:",isAdmin, "claims:",claims)
  return <>{children}</>;
}

export function resolveRule(pathname: string | null) {
  if (!pathname) return null;

  const clean = pathname.replace(/^\//, "");

  return Object.entries(ACCESS_CONTROL)
    .filter(([key]) => clean === key || clean.startsWith(`${key}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;
}
