import { APP_SECURE_AUTH_STATE_KEY } from "@/constants/Config";
import { deleteItemAsync } from "expo-secure-store";
import { Platform } from "react-native";
import { getSecret, saveSecret } from "../AuthHelpers";
import { createUserStorage } from "../storage/Storage";

export const mmkv = createUserStorage('auth_session');

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
  return expiry ?? 60;
}

export async function saveExpiry(expiry: number=300) {
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
