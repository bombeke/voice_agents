import { useAuth } from "@/providers/AuthProvider";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const { isAuthenticated, loading, setRedirectAfterLogin } = useAuth();
  const segments = useSegments();
  const hasSetRedirect = useRef(false);

  useEffect(() => {
    // Only set redirect once when user becomes unauthenticated
    if (!isAuthenticated && segments.length > 0 && !hasSetRedirect.current) {
      const path = `/${segments.join("/")}`;
      // Don't redirect to login page itself
      if (path !== "/(auth)/login") {
        setRedirectAfterLogin(path);
        hasSetRedirect.current = true;
      }
    }

    // Reset flag when authenticated
    if (isAuthenticated) {
      hasSetRedirect.current = false;
    }
  }, [isAuthenticated, segments, setRedirectAfterLogin]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={{ pathname: "/(tabs)" }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
