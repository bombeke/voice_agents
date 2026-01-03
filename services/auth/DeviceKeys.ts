import { DEVICE_KEY_NAME } from "@/constants/Config";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getSecret, saveSecret } from "../AuthHelpers";


/**
 * Convert ArrayBuffer → base64url
 */
export function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Convert base64url → ArrayBuffer
 */
export function fromBase64url(input: string): ArrayBuffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - base64.length) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


export async function getDeviceKeyPair(): Promise<CryptoKeyPair> {
  if (!global.crypto?.subtle) {
    throw new Error("WebCrypto not available");
  }

  const stored = await getSecret(DEVICE_KEY_NAME);
  if (stored) {
    const parsed = JSON.parse(stored);

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      fromBase64url(parsed.privateKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    const publicKey = await crypto.subtle.importKey(
      "spki",
      fromBase64url(parsed.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    return { privateKey, publicKey };
  }
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const privateKey = await crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );
  const publicKey = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );

  await saveSecret(
    DEVICE_KEY_NAME,
    JSON.stringify({
      privateKey: base64url(privateKey),
      publicKey: base64url(publicKey),
    }),
    {
      keychainAccessible:
        Platform.OS === "ios"
          ? SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
          : undefined,
    }
  );

  return keyPair;
}

export async function signRequest(
  method: string,
  url: string,
  body?: any
): Promise<{
  signature: string;
  timestamp: number;
}> {
  const { privateKey } = await getDeviceKeyPair();

  const ts = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    m: method.toUpperCase(),
    u: url,
    b: body ? JSON.stringify(body) : "",
   // s: sessionId,
    t: ts,
  });

  const data = new TextEncoder().encode(payload);

  const sig = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    data
  );

  return {
    signature: base64url(sig),
    timestamp: ts,
  };
}
