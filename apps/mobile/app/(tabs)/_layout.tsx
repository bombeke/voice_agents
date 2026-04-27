import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Redirect, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const { loading, isAuthenticated } = useAuth();
  const segments = useSegments();
  console.log("Segments:",segments)
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <AppTabs />;
}