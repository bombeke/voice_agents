import { MMKVProvider } from "@/components/MmkvContext";
import { fontAssets } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { devMocks } from "@/mocks";
import { AuthProvider } from "@/providers/AuthProvider";
import { DetectorModelProvider } from "@/providers/DetectorModelProvider";
import { UtilityStoreProvider } from "@/providers/UtilityStoreProvider";
import { queryClient } from "@/services/Api";
import { BackendSyncObserver } from "@/services/storage/BackendSyncObserver";
import { initPersistence } from "@/services/storage/LegendState";
import { OpQueueReplayObserver } from "@/services/storage/OpQueueReplayObserver";
import { createUserStorage } from "@/services/storage/Storage";
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

const userId = "mmkv_user_app";
const storage = createUserStorage(userId);
initPersistence();
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
            <UtilityStoreProvider>
              <DetectorModelProvider>
                <SafeAreaProvider>
                  {/* Feeds insets to uniwind's `*-safe` utilities. */}
                  <SafeAreaListener
                    onChange={({ insets }) => Uniwind.updateInsets(insets)}
                  >
                    <BackendSyncObserver />
                    <OpQueueReplayObserver />
                    <RootLayoutNav />
                  </SafeAreaListener>
                </SafeAreaProvider>
              </DetectorModelProvider>
            </UtilityStoreProvider>
          </AuthProvider>
        </MMKVProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
