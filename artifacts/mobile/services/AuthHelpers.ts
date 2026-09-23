import {
  getItemAsync,
  SecureStoreOptions,
  setItemAsync,
} from "expo-secure-store";

export async function saveSecret(
  key: string,
  value: string,
  options?: SecureStoreOptions,
) {
  await setItemAsync(key, value, options);
}

export async function getSecret(key: string) {
  return (await getItemAsync(key)) ?? null;
}
