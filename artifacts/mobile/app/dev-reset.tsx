import { devMocks } from "@/mocks";
import { Routes } from "@/services/Routes";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

/**
 * Dev-only: `mobile://dev-reset` replaces the signed-in user's mock data
 * with a fresh seed. Only in `start:mock` builds; `devMocks` is null in
 * every other bundle.
 */
export default function DevResetScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("Resetting mock data…");

  useEffect(() => {
    if (!devMocks) return;
    devMocks
      .reseed()
      .then(() => router.replace(Routes.HOME))
      .catch((err: unknown) => setMessage(String(err)));
  }, [router]);

  if (!devMocks) return null;
  return (
    <View className="flex-1 items-center justify-center bg-background p-5">
      <Text className="type-body text-text">{message}</Text>
    </View>
  );
}
