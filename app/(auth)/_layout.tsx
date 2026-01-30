import { useAuth } from "@/providers/AuthProvider";
import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const {
    isAuthenticated,
    loading,
    redirectAfterLogin,
    setRedirectAfterLogin,
  } = useAuth();

  const pathname = usePathname();
  const capturedRef = useRef<string | null>(null);

  /**
   * Capture intended route ONCE while unauthenticated
   */
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;
    if (!pathname) return;
    if (pathname.startsWith("/(auth)")) return;

    if (capturedRef.current === pathname) return;

    setRedirectAfterLogin(pathname);
    capturedRef.current = pathname;
  }, [pathname, loading, isAuthenticated]);

  /**
   * Once authenticated, redirect and clear intent
   */
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    const target = redirectAfterLogin ?? "/(tabs)";
    return <Redirect href={target as any} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
