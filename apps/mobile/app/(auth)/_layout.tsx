import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Stack, usePathname, useRouter } from "expo-router";
import { memo, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

function AuthLayout() {
  const {
    isAuthenticated,
    loading,
    redirectAfterLogin,
    setRedirectAfterLogin,
    claims
  } = useAuth();

  const pathname = usePathname();
  const router = useRouter();


  /**
   * Capture intended route before login
   */
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;

    if (!claims) return;

    const target = redirectAfterLogin ?? Routes.TABS;

    if (pathname === target) return;

    setRedirectAfterLogin(undefined);
    if (pathname !== target) {
      router.replace(target as any);
    }
  }, [
    loading,
    isAuthenticated,
    claims,
    redirectAfterLogin,
    pathname,
  ]);

  console.log("AUTH:",{
    loading,
    isAuthenticated,
    claims,
    redirectAfterLogin,
    pathname
  })

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
