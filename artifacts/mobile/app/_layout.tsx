import { MMKVProvider } from "@/components/MmkvContext";
import { fontAssets } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { devMocks } from "@/mocks";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { DetectorModelProvider } from "@/providers/DetectorModelProvider";
import { queryClient } from "@/services/Api";
import { installSessionRefresh } from "@/services/auth/SessionRefresh";
import { BackendSyncObserver } from "@/services/storage/BackendSyncObserver";
import { COLD_START_MARK } from "@/constants/Config";
import { mark } from "@/db/Timing";
import { initPersistence } from "@/services/storage/LegendState";
import { createUserStorage } from "@/services/storage/Storage";
import { ReviewSyncObserver } from "@/services/sync/ReviewSyncObserver";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView as RNGestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaListener,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { Uniwind, withUniwind } from "uniwind";
import "../global.css";

const GestureHandlerRootView = withUniwind(RNGestureHandlerRootView);

SplashScreen.preventAutoHideAsync();

export function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="capture"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

/**
 * Upload and pull only while someone is signed in: the queues open are that
 * user's, so they always go up with their owner's token.
 */
function SignedInSync() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return (
    <>
      <BackendSyncObserver />
      <ReviewSyncObserver />
    </>
  );
}

// Debug timing (EXPO_PUBLIC_DB_TIMING=1): cold start to the first painted list.
mark(COLD_START_MARK);
const userId = "mmkv_user_app";
const storage = createUserStorage(userId);
initPersistence();
installSessionRefresh();
// Dev-only fake API; `devMocks` is null in release bundles (metro.config.js).
devMocks?.install();

export default function RootLayout() {
  useNetworkStatus();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...fontAssets,
  });
  // Only fonts hold the splash; the detector downloads in DetectorModelProvider.
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView className="flex-1 bg-background">
        <MMKVProvider storage={storage}>
          <AuthProvider>
            <DetectorModelProvider>
              <SafeAreaProvider>
                {/* Feeds insets to uniwind's `*-safe` utilities. */}
                <SafeAreaListener
                  onChange={({ insets }) => Uniwind.updateInsets(insets)}
                >
                  <SignedInSync />
                  <RootLayoutNav />
                </SafeAreaListener>
              </SafeAreaProvider>
            </DetectorModelProvider>
          </AuthProvider>
        </MMKVProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
