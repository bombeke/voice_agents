import { useAuth } from "@/providers/AuthProvider";
import { ACCESS_CONTROL } from "@/services/auth/AccessControl";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { usePathname, useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export function GuardedLayout({ children }: PropsWithChildren) {
  const { loading, isAuthenticated, isAdmin, adminMode, claims } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const redirectedRef = useRef(false);

  const rule = resolveRule(pathname);

  useEffect(() => {
    if (!rule) return;
    if (loading) return;
    if (redirectedRef.current) return;

    // Auth required
    if (rule.requireAuth && !isAuthenticated) {
      redirectedRef.current = true;
      router.replace(rule.fallback ?? (Routes.LOGIN as any));
      return;
    }

    // Admin required
    if (rule.requireAdmin && !isAdmin) {
      redirectedRef.current = true;
      router.replace(rule.fallback ?? (Routes.TABS as any));
      return;
    }

    // Claims not ready yet → wait
    if (rule.permission && !claims) {
      return;
    }

    // Permission required
    if (rule.permission && !hasPerm(claims as any, rule.permission)) {
      redirectedRef.current = true;
      router.replace(rule.fallback ?? (Routes.TABS as any));
      return;
    }

    // Offline restriction → handled in render (no redirect)
  }, [rule, loading, isAuthenticated, isAdmin, claims, router]);

  /**
   * Loading / resolving state
   */
  if (loading) {
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
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-center text-gray-600">
          This feature is unavailable in offline mode.
        </Text>
      </View>
    );
  }

  if (rule && redirectedRef.current) {
    return null;
  }

  return <>{children}</>;
}

export function resolveRule(pathname: string | null) {
  if (!pathname) return null;

  const clean = pathname.replace(/^\//, "");

  return (
    Object.entries(ACCESS_CONTROL)
      .filter(([key]) => clean.startsWith(key))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null
  );
}
