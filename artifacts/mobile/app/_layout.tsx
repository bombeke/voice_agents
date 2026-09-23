import { AppReadyProvider } from "@/components/AppReadyContext";
import { MMKVProvider } from "@/components/MmkvContext";
import { fontAssets } from "@/constants/theme";
import { devMocks } from "@/mocks";
import { AuthProvider } from "@/providers/AuthProvider";
import { UtilityStoreProvider } from "@/providers/UtilityStoreProvider";
import { queryClient } from "@/services/Api";
import { prepareAndInitializeModel } from "@/services/PrepareModel";
import { BackendSyncObserver } from "@/services/storage/BackendSyncObserver";
import { initPersistence } from "@/services/storage/LegendState";
import { OpQueueReplayObserver } from "@/services/storage/OpQueueReplayObserver";
import { createUserStorage } from "@/services/storage/Storage";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView as RNGestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaListener,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { Uniwind, withUniwind } from "uniwind";
import "../global.css";

import { initExecutorch } from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";

const GestureHandlerRootView = withUniwind(RNGestureHandlerRootView);

SplashScreen.preventAutoHideAsync();

interface RootLayoutNavProps {
  ready: boolean;
}

export function RootLayoutNav({ ready }: RootLayoutNavProps) {
  //const deviceId =  useValue(poleVisionDBDeviceId$)

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
        initialParams={{ ready }}
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

initExecutorch({
  resourceFetcher: ExpoResourceFetcher,
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...fontAssets,
  });
  useEffect(() => {
    (async () => {
      const path = await prepareAndInitializeModel();
      setReady(true);
      await SplashScreen.hideAsync();
    })();
  }, []);

  if (!loaded || !ready) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView className="flex-1 bg-background">
        <MMKVProvider storage={storage}>
          <AuthProvider>
            <UtilityStoreProvider>
              {/*<CachedModelBootstrap>*/}
              <SafeAreaProvider>
                {/* Feeds insets to uniwind's `*-safe` utilities. */}
                <SafeAreaListener
                  onChange={({ insets }) => Uniwind.updateInsets(insets)}
                >
                  <BackendSyncObserver />
                  <OpQueueReplayObserver />
                  <AppReadyProvider ready={ready}>
                    <RootLayoutNav ready={ready} />
                  </AppReadyProvider>
                </SafeAreaListener>
              </SafeAreaProvider>
              {/*</CachedModelBootstrap>*/}
            </UtilityStoreProvider>
          </AuthProvider>
        </MMKVProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
