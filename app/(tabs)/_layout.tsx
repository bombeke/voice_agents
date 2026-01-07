import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Redirect, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const {
    isAuthenticated,
    loading,
    setRedirectAfterLogin,
  } = useAuth();

  const segments = useSegments();

  useEffect(() => {
    if (!loading && !isAuthenticated && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, [loading, isAuthenticated, segments, setRedirectAfterLogin]);

  return (
    <>
      <AppTabs />

      {/* Overlay logic instead of replacing navigator */}
      {loading && (
        <View style={{ position: "absolute", inset: 0, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {!loading && !isAuthenticated && (
        <Redirect href={Routes.LOGIN} />
      )}
    </>
  );

}
