import { MMKVProvider } from '@/components/MmkvContext';
import { CachedModelProvider } from '@/components/ModelContext';
import { useCachedModel } from '@/hooks/useCachedModel';
import { createUserStorage } from '@/services/storage/Storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import "../global.css";
import { config } from '../tamagui.config';

//import { RxDBProvider } from '@/providers/RxDBContext';
//import { UtilityStoreProvider } from '@/providers/UtilityStoreProvider';

import { UtilityStoreProvider } from '@/providers/UtilityStoreProvider';
import { queryClient } from '@/services/Api';
import { BackendSyncObserver } from '@/services/storage/BackendSyncObserver';
import { initPersistence, poleVisionDBDeviceId$ } from '@/services/storage/LegendState';
import { OpQueueReplayObserver } from '@/services/storage/OpQueueReplayObserver';
import { useValue } from '@legendapp/state/react';
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

export function RootLayoutNav() {

  const deviceId =  useValue(poleVisionDBDeviceId$);
  console.log("Device ID:",deviceId);
  /*useEffect(() => {
    const trackerSync = new EventSyncManager({
      actorId: `device:${deviceId}`,
      batchSize: 20,
      intervalMs: 30_000,
      mergeStrategy: 'LWW',
    });

    const stop = trackerSync.startAuto();
    return stop; // cleanup on unmount
  }, [deviceId]);
  */

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
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
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const userId = 'mmkv_user_app';
  const storage = createUserStorage(userId);
  const { model } = useCachedModel();
  initPersistence()

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.container}>
        <TamaguiProvider config={config}>
          <MMKVProvider storage={storage}>
              <UtilityStoreProvider>
                <CachedModelProvider model= { model}>
                  <SafeAreaProvider>
                    <BackendSyncObserver/>
                    <OpQueueReplayObserver/>
                    <RootLayoutNav/>
                  </SafeAreaProvider> 
                </CachedModelProvider>
              </UtilityStoreProvider>
          </MMKVProvider>
        </TamaguiProvider>    
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
