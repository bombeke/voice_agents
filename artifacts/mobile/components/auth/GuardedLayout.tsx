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

  // Auth is still settling: we know neither where to send the user nor whether
  // the guarded subtree is allowed to render.
  const resolving = loading || (isAuthenticated && !claims);
  const hasChildren = Boolean(children);

  useEffect(() => {
    if (resolving) return;

    if (!isAuthenticated) {
      router.replace(Routes.LOGIN as any);
      return;
    }

    // Used as a bare entry gate (no children): bounce into the app shell.
    // When it wraps a subtree we must NOT redirect — doing so unconditionally
    // sends every navigation inside that subtree straight back to the tabs
    // root, which looks exactly like the tabs not responding to taps.
    if (!hasChildren) {
      router.replace(Routes.TABS as any);
    }
  }, [resolving, isAuthenticated, hasChildren, router]);

  if (resolving) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

export function resolveRule(pathname: string | null) {
  if (!pathname) return null;

  const clean = pathname.replace(/^\//, "");

  return Object.entries(ACCESS_CONTROL)
    .filter(([key]) => clean === key || clean.startsWith(`${key}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;
}
