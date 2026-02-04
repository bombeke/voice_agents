import { getRandomBytesAsync } from "expo-crypto";
import { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } from "expo-secure-store";
import { Platform } from "react-native";
import { getSecret, saveSecret } from "../AuthHelpers";

const SECRET_KEY = "DEVICE_SECRET_V1";
const ROTATION_INTERVAL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type StoredSecret = {
  value: string;
  createdAt: number;
};

export async function getOrRotateSecret(): Promise<Uint8Array> {
  const stored = await getSecret(SECRET_KEY);

  if (stored) {
    const parsed: StoredSecret = JSON.parse(stored);

    if (Date.now() - parsed.createdAt < ROTATION_INTERVAL_MS) {
      return Uint8Array.from(atob(parsed.value), c => c.charCodeAt(0));
    }
  }

  const secret = await getRandomBytesAsync(32);

  await saveSecret(
    SECRET_KEY,
    JSON.stringify({
      value: btoa(String.fromCharCode(...secret)),
      createdAt: Date.now(),
    }),
    {
      keychainAccessible:
        Platform.OS === "ios"
          ? AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          : undefined,
    }
  );

  return secret;
}
