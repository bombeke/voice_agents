import { MMKVProvider } from "@/components/MmkvContext";
import {
  CachedModelBootstrap
} from "@/components/ModelContext";
import { createUserStorage } from "@/services/storage/Storage";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";
import "../global.css";
import { config } from "../tamagui.config";

import { AuthProvider } from "@/providers/AuthProvider";
import { UtilityStoreProvider } from "@/providers/UtilityStoreProvider";
import { queryClient } from "@/services/Api";
import { BackendSyncObserver } from "@/services/storage/BackendSyncObserver";
import { initPersistence } from "@/services/storage/LegendState";
import { OpQueueReplayObserver } from "@/services/storage/OpQueueReplayObserver";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

export function RootLayoutNav() {
  //const deviceId =  useValue(poleVisionDBDeviceId$);
  //console.log("Device ID:",deviceId);
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const userId = "mmkv_user_app";
  const storage = useMemo(() => createUserStorage(userId), [userId]);
  useEffect(() => {
    initPersistence();
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <TamaguiProvider config={config}>
          <MMKVProvider storage={storage}>
            <AuthProvider>
              <UtilityStoreProvider>
                <CachedModelBootstrap>
                  <SafeAreaProvider>
                    <BackendSyncObserver />
                    <OpQueueReplayObserver />
                    <RootLayoutNav />
                  </SafeAreaProvider>
                </CachedModelBootstrap>
              </UtilityStoreProvider>
            </AuthProvider>
          </MMKVProvider>
        </TamaguiProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
