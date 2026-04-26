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
    claims,
  } = useAuth();

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    //if (!claims) return;

    const target = redirectAfterLogin ?? Routes.TABS;
    console.log("target:",{
      target,
      pathname
    })
    if (pathname !== target) {
      setRedirectAfterLogin(undefined);
      router.replace(target as any);
    }
  }, [loading, isAuthenticated, claims, redirectAfterLogin, pathname,setRedirectAfterLogin]);

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