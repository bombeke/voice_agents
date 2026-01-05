import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Redirect, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function TabsLayout() {
  
    const {
    isAuthenticated,
    loading,
    claims,
    setRedirectAfterLogin,
  } = useAuth();

  const segments = useSegments();

  useEffect(() => {
    if (!loading && !isAuthenticated  && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, [loading, isAuthenticated,segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={ Routes.LOGIN} />;
  }
  
  return (
      <View
        style={styles.layout}
      >
        <AppTabs />
      </View>
  );
}
const styles = StyleSheet.create({
  layout: {
    flex: 1,
    backgroundColor: "#F3F4F6", // Shared background for all tabs
  },
});