import AppTabs from "@/components/AppTabs";
import { useAuth } from "@/providers/AuthProvider";
import { Routes } from "@/services/Routes";
import { useRouter, useSegments } from "expo-router";
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
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated && segments.length > 0) {
      setRedirectAfterLogin(`/${segments.join("/")}`);
    }
  }, [loading, isAuthenticated, segments,setRedirectAfterLogin]);

  useEffect(() => {
      if (!loading) {
        if (!isAuthenticated) {
          // Redirect to login if not authenticated
          router.replace(Routes.LOGIN as any);
        } 
        else if (!isAdmin) {
          // Redirect to tabs if not admin
          router.replace(Routes.TABS);
        }
      }
    }, [loading, isAuthenticated, isAdmin]);

    // Show loading overlay
    if (loading) {
      return (
        <View style={{ position: "absolute", inset: 0, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    // Don't render anything while redirecting or if unauthorized
    if (!isAuthenticated || !isAdmin) {
      return null; // or a loading spinner while redirect happens
    }
  return <AppTabs />
}