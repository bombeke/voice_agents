import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Redirect, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";


export default function AdminLayout() {
  const {
    loading,
    isAuthenticated,
    claims,
    isAdmin, 
    offlineMode,
    setRedirectAfterLogin
  } = useAuth();
  const segments = useSegments();

    useEffect(() => {
    if (!loading && !isAuthenticated && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, [loading, isAuthenticated]);

  /**
   * ⏳ Loading guard
   */
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={Routes.LOGIN }/>;
  }

  if (!isAdmin) {
    return <Redirect href={Routes.TABS} />;
  }
  return (
    <AppTabs/>
  );
}
