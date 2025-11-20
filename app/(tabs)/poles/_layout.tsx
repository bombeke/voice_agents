import { Stack } from 'expo-router';

export default function PolesTabsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="capture" />
      <Stack.Screen name="maps" options={{ headerShown: false }} />
    </Stack>
  );
}
