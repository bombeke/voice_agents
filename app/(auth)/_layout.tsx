import { useAuth } from "@/providers/AuthProvider";
import { Redirect, Stack, usePathname } from "expo-router";
import { memo, useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

function AuthLayout() {
  const {
    isAuthenticated,
    loading,
    redirectAfterLogin,
    setRedirectAfterLogin,
  } = useAuth();

  const pathname = usePathname();
  const capturedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;
    if (!pathname) return;
    if (pathname.startsWith("/(auth)")) return;

    if (capturedRef.current === pathname) return;

    setRedirectAfterLogin(pathname);
    capturedRef.current = pathname;
  }, [pathname, loading, isAuthenticated]);

  if (loading) {
    console.log("Loading M0");
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    console.log("Loading M1");
    const target = redirectAfterLogin ?? "/(tabs)";
    return <Redirect href={target as any} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default memo(AuthLayout);
