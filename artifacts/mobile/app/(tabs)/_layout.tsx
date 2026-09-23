import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 justify-center bg-background">
        <ActivityIndicator size="large" colorClassName="accent-primary" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={Routes.LOGIN} />;
  }

  return <AppTabs />;
}
