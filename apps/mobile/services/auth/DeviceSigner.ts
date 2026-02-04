import * as Application from "expo-application";
import { getRandomBytesAsync } from "expo-crypto";
import * as Device from "expo-device";
import { sha256 } from "js-sha256";
import { getOrRotateSecret } from "./DeviceSecret";

export function getDeviceFingerprint(): string {
  const raw = [
    Device.brand,
    Device.modelName,
    Device.osName,
    Device.osVersion,
    Application.applicationId,
  ].join("|");

  return sha256(raw);
}

export async function signRequest(
  method: string,
  url: string,
  body?: unknown
) {
  const secret = await getOrRotateSecret();
  const fingerprint = getDeviceFingerprint();

  const timestamp = Math.floor(Date.now() / 1000);
  const nonceBytes = await getRandomBytesAsync(12);
  const nonce = Array.from(nonceBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const payload = JSON.stringify({
    m: method.toUpperCase(),
    u: url,
    b: body ? JSON.stringify(body) : "",
    t: timestamp,
    n: nonce,
    f: fingerprint,
  });

  const signature = sha256.hmac(
    btoa(String.fromCharCode(...secret)),
    payload
  );

  return {
    signature,
    timestamp,
    nonce,
    fingerprint,
  };
}
