import { ROTATION_INTERVAL, ROTATION_KEY } from "@/constants/Config";
import { deleteItemAsync } from "expo-secure-store";
import { getSecret, saveSecret } from "../AuthHelpers";




export async function maybeRotateKey(): Promise<boolean> {
  const last = await getSecret(ROTATION_KEY);
  const now = Math.floor(Date.now() / 1000);

  if (last && now - Number(last) < ROTATION_INTERVAL) {
    return false;
  }

  await deleteItemAsync("device_keypair_v1");


  await saveSecret(ROTATION_KEY, String(now));
  return true;
}
