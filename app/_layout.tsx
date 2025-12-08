import { MMKVProvider } from '@/components/MmkvContext';
import { CachedModelProvider } from '@/components/ModelContext';
import { useCachedModel } from '@/hooks/useCachedModel';
import { createUserStorage } from '@/services/storage/Storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import "../global.css";
import "../polyfills";
import { config } from '../tamagui.config';

import { RxDBProvider } from '@/providers/RxDBContext';
import { UtilityPoleProvider } from '@/providers/UtilityStoreProvider';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export function RootLayoutNav() {
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
            <RxDBProvider>
              <UtilityPoleProvider>
                <CachedModelProvider model= { model}>
                  <SafeAreaProvider>
                    <RootLayoutNav/>
                  </SafeAreaProvider> 
                </CachedModelProvider>
              </UtilityPoleProvider>
            </RxDBProvider>
          </MMKVProvider>
        </TamaguiProvider>    
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
