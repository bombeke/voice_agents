import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  console.log("Loading Tab0", loading, "auth:", isAuthenticated);
  if (loading) {
    return (
      <View
        style={{ position: "absolute", inset: 0, justifyContent: "center" }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <AppTabs />;
}
