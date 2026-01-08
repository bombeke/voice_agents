import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const {
    isAuthenticated,
    loading,
    setRedirectAfterLogin,
  } = useAuth();
  const router = useRouter();

  const segments = useSegments();

  useEffect(() => {
    if (!loading && !isAuthenticated && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, [loading, isAuthenticated, segments, setRedirectAfterLogin]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(Routes.LOGIN as any);
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
        <View style={{ position: "absolute", inset: 0, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }
  return <AppTabs />

}
