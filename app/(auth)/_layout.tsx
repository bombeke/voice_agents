import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Stack, usePathname, useRouter } from "expo-router";
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
  const router = useRouter();

  const capturedRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  /**
   * Capture intended route before login
   */
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;
    if (!pathname) return;
    if (pathname.startsWith("/(auth)")) return;
    if (capturedRef.current === pathname) return;

    capturedRef.current = pathname;
    setRedirectAfterLogin(pathname);
  }, [pathname, loading, isAuthenticated, setRedirectAfterLogin]);

  /**
   * Perform redirect ONCE after authentication
   */
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    if (redirectedRef.current) return;

    const target = redirectAfterLogin ?? Routes.TABS;

    if (pathname === target) return;

    redirectedRef.current = true;

    setRedirectAfterLogin(undefined);

    router.replace(target as any);
  }, [
    loading,
    isAuthenticated,
    redirectAfterLogin,
    pathname,
    router,
    setRedirectAfterLogin,
  ]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default memo(AuthLayout);
