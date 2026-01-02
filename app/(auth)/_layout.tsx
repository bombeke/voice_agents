import { useAuth } from "@/providers/AuthProvider";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const {
    isAuthenticated,
    loading,
    setRedirectAfterLogin,
  } = useAuth();

  const segments = useSegments();

  useEffect(() => {
    if (!isAuthenticated  && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, []);
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={{ pathname: "/(tabs)"}} />;
  }

  return <Stack screenOptions={{ headerShown: false }}/>;
}
