import { APP_SECURE_AUTH_STATE_KEY } from "@/constants/Config";
import { deleteItemAsync } from "expo-secure-store";
import { Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { getSecret, saveSecret } from "../AuthHelpers";

export const mmkv = createMMKV();

export async function getToken() {
  let token = mmkv.getString("token");
  if (token) return token;
  return await getSecret(APP_SECURE_AUTH_STATE_KEY);
}

export async function saveToken(token: string) {
  mmkv.set("token", token);
  await saveSecret(APP_SECURE_AUTH_STATE_KEY, token);
}

export async function getExpiry() {
  const expiry = mmkv.getNumber("expiry");
  return expiry ?? null;
}

export async function saveExpiry(expiry: number) {
  mmkv.set("expiry", expiry);
}

export async function clearAuth() {
  mmkv.clearAll();
  if (Platform.OS !== "web") {
    await deleteItemAsync("token");
  }
}

export function saveClaims(claims: any) {
  mmkv.set("claims", JSON.stringify(claims));
}

export function getClaims() {
  const raw = mmkv.getString("claims");
  return raw ? JSON.parse(raw) : null;
}
