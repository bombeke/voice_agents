import { useAuth } from "@/providers/AuthProvider";
import { ACCESS_CONTROL } from "@/services/auth/AccessControl";
import { Routes } from "@/services/Routes";
import { useRouter } from "expo-router";
import { PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

/*export function GuardedLayout({ children }: PropsWithChildren) {
  const { loading, isAuthenticated, isAdmin, adminMode, claims } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const rule = resolveRule(pathname);

  useEffect(() => {
    if (!rule) return;
    if (loading) return;

    if (isAuthenticated && !claims) return;

    if (rule.requireAuth && !isAuthenticated) {
      router.replace(rule.fallback ?? Routes.LOGIN as any);
      return;
    }

    if (rule.requireAdmin && !isAdmin) {
      router.replace(rule.fallback ?? Routes.TABS as any);
      return;
    }

    if (rule.permission && !hasPerm(claims as any, rule.permission)) {
      router.replace(rule.fallback ?? Routes.TABS as any);
      return;
    }
  }, [rule, loading, isAuthenticated, isAdmin, claims]);

  // 🔒 HARD BLOCK (prevents flash + ensures redirect works)
  if (!loading && rule?.requireAuth && !isAuthenticated) {
    return null;
  }

  // ⏳ Loading / claims resolving
  if (loading || (isAuthenticated && !claims)) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Offline restriction
  if (
    rule &&
    adminMode === "offline-readonly" &&
    rule.allowOfflineReadonly === false
  ) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-center text-gray-600">
          This feature is unavailable in offline mode.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}*/


export function GuardedLayout({ children }: PropsWithChildren) {
  const { loading, isAuthenticated, claims } = useAuth();
  const router = useRouter();

  /**
   * 🔁 Redirect logic
   */
  useEffect(() => {
    if (loading) return;

    // Wait for claims if authenticated
    if (isAuthenticated && !claims) return;

    if (!isAuthenticated) {
      // 🔴 Not logged in → go to login
      router.replace(Routes.LOGIN as any);
      return;
    }

    // ✅ Logged in → go to dashboard
    router.replace(Routes.TABS as any);

  }, [loading, isAuthenticated, claims]);

  /**
   * ⏳ Block UI until auth is resolved
   */
  if (loading || (isAuthenticated && !claims)) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /**
   * 🔒 Prevent rendering before redirect happens
   */
  return null;
}
export function resolveRule(pathname: string | null) {
  if (!pathname) return null;

  const clean = pathname.replace(/^\//, "");

  return Object.entries(ACCESS_CONTROL)
    .filter(([key]) => clean === key || clean.startsWith(`${key}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;
}
