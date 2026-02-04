import { DEVICE_KEY_NAME } from "@/constants/Config";
import { getRandomBytesAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { sha256 } from "js-sha256";
import { Platform } from "react-native";
import { getSecret, saveSecret } from "../AuthHelpers";

/* ------------------------------------------------------------------ */
/* Base64URL helpers (pure JS)                                         */
/* ------------------------------------------------------------------ */

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/* ------------------------------------------------------------------ */
/* Device Secret Management                                            */
/* ------------------------------------------------------------------ */

export async function getDeviceSecret(): Promise<Uint8Array> {
  const stored = await getSecret(DEVICE_KEY_NAME);

  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  }

  // 🔐 Generate device-bound random secret
  const secret = await getRandomBytesAsync(32);

  await saveSecret(
    DEVICE_KEY_NAME,
    btoa(String.fromCharCode(...secret)),
    {
      keychainAccessible:
        Platform.OS === "ios"
          ? SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          : undefined,
    }
  );

  return secret;
}

/* ------------------------------------------------------------------ */
/* Request Signing (HMAC-SHA256 style)                                 */
/* ------------------------------------------------------------------ */

export async function signRequest(
  method: string,
  url: string,
  body?: unknown
): Promise<{
  signature: string;
  timestamp: number;
}> {
  const secret = await getDeviceSecret();
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = JSON.stringify({
    m: method.toUpperCase(),
    u: url,
    b: body ? JSON.stringify(body) : "",
    t: timestamp,
  });

  // 🔑 HMAC-like construction (pure JS)
  const key = base64url(secret);
  const signatureHex = sha256.hmac(key, payload);

  return {
    signature: signatureHex,
    timestamp,
  };
}
