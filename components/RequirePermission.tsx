import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Props = PropsWithChildren<{
  permission: string;
  fallback?: string;
  allowOfflineReadonly?: boolean;
}>;

export function RequirePermission({
  permission,
  fallback = Routes.TABS,
  allowOfflineReadonly = false,
  children,
}: Props) {
  const { loading, isAuthenticated, claims, adminMode } = useAuth();
  const router = useRouter();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (redirectedRef.current) return;

    // Not logged in → login
    if (!isAuthenticated) {
      redirectedRef.current = true;
      router.replace(Routes.LOGIN as any);
      return;
    }

    // Claims not ready yet → wait
    if (!claims) return;

    // Permission denied
    if (!hasPerm(claims as any, permission)) {
      redirectedRef.current = true;
      router.replace(fallback as any);
      return;
    }

    // Offline admin restriction
    if (adminMode === "offline-readonly" && !allowOfflineReadonly) {
      // no redirect, UI message instead
      return;
    }
  }, [
    loading,
    isAuthenticated,
    claims,
    permission,
    fallback,
    adminMode,
    allowOfflineReadonly,
    router,
  ]);

  if (loading || !isAuthenticated || !claims) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
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

  if (!hasPerm(claims as any, permission)) {
    return null;
  }

  return <>{children}</>;
}
