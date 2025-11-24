import { MMKVProvider } from '@/components/MmkvContext';
import { createUserStorage } from '@/services/storage/Storage';
import { useFonts } from 'expo-font';
import { Slot, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import "../global.css";
import { config } from '../tamagui.config';


export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const userId = 'mmkv_user_app';
  const storage = createUserStorage(userId);
  
  if (!loaded) {
    return null;
  }

  return (
    <TamaguiProvider config={config}>
      <MMKVProvider storage={storage}>
        <SafeAreaProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <Slot/>
        </SafeAreaProvider> 
      </MMKVProvider>
    </TamaguiProvider>    
  );
}
