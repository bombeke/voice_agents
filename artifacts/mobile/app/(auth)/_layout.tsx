import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Stack, useRouter } from "expo-router";
import { memo, useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

function AuthLayout() {
  const {
    isAuthenticated,
    loading,
    redirectAfterLogin,
    setRedirectAfterLogin,
  } = useAuth();

  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      // Signed out again: allow the next successful login to redirect.
      redirectedRef.current = false;
      return;
    }

    // Redirect exactly once per login. Comparing against `usePathname()` does
    // not work here: pathnames never contain group segments, so `/(tabs)` can
    // never equal the current path and the effect would fire on every
    // navigation, yanking the user back to the tabs root.
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const target = redirectAfterLogin ?? Routes.TABS;
    setRedirectAfterLogin(undefined);
    router.replace(target as any);
  }, [
    loading,
    isAuthenticated,
    redirectAfterLogin,
    setRedirectAfterLogin,
    router,
  ]);

  if (loading) {
    return (
      <View className="flex-1 justify-center bg-background">
        <ActivityIndicator size="large" colorClassName="accent-primary" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default memo(AuthLayout);
