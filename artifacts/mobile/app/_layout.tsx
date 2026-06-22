import { AppReadyProvider } from "@/components/AppReadyContext";
import { MMKVProvider } from "@/components/MmkvContext";
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
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";
import "../global.css";
import { config } from "../tamagui.config";

import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';


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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffff",
  },
});

const userId = "mmkv_user_app";
const storage = createUserStorage(userId);
initPersistence();

initExecutorch({
  resourceFetcher: ExpoResourceFetcher,
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
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
      <GestureHandlerRootView style={styles.container}>
        <TamaguiProvider config={config}>
          <MMKVProvider storage={storage}>
            <AuthProvider>
              <UtilityStoreProvider>
                {/*<CachedModelBootstrap>*/}
                <SafeAreaProvider>
                  <BackendSyncObserver />
                  <OpQueueReplayObserver />
                  <AppReadyProvider ready={ready}>
                    <RootLayoutNav ready={ready} />
                  </AppReadyProvider>
                </SafeAreaProvider>
                {/*</CachedModelBootstrap>*/}
              </UtilityStoreProvider>
            </AuthProvider>
          </MMKVProvider>
        </TamaguiProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
