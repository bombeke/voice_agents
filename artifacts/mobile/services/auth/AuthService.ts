import { IClaims } from "@/providers/AuthProvider";
import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import { jwtDecode } from "jwt-decode";
import { axiosClient } from "../Api";
import {
  clearAuth,
  getExpiry,
  getToken,
  saveExpiry,
  saveToken
} from "./AuthStorage";

import { AuthSessionResult } from "expo-auth-session";

/**
 * Refresh the current session token using Casdoor refresh token or code
 * Returns true if session successfully refreshed
 * Returns false if token could not be refreshed
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected || !net.isInternetReachable) {
      console.warn("Offline, cannot refresh session");
      return false;
    }

    const token = await getToken();
    const expiry = await getExpiry();

    if (!token || !expiry) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    if (expiry > now + 120) {
      return true;
    }

    const res = await axiosClient.post("/auth/refresh", { token });

    const newToken = res.data?.token ?? res.data?.access_token;
    if (!newToken) {
      await clearAuth();
      return false;
    }
    let decoded = res.data?.claims;
    try {
      decoded = jwtDecode<IClaims>(newToken);
    }
    catch (error: any) {
      console.log("Refresh Decoding: ", error.message);
    }
    console.log("Refresh Token Decoded:", decoded);
    const newExpiry = decoded.exp;
    await saveToken(newToken);
    await saveExpiry(newExpiry);
    //saveClaims(decoded);

    return true;
  } 
  catch (err: any) {
    console.error("Failed to refresh session:", err);
    await clearAuth();
    return false;
  }
}

export function validateCasdoorRedirect(
  redirectUri: string,
  returnedUrl: string,
) {
  const expected = Linking.parse(redirectUri);
  const actual = Linking.parse(returnedUrl);

  if (expected.scheme !== actual.scheme) {
    throw new Error("Invalid redirect scheme");
  }

  if (expected.hostname !== actual.hostname) {
    throw new Error("Invalid redirect host");
  }

  return true;
}

export function validateCasdoorAuthResponse(
  response: AuthSessionResult | null,
  expectedState?: string,
): asserts response is AuthSessionResult & {
  type: "success";
  params: { code: string; state: string };
} {
  if (!response || response.type !== "success") {
    throw new Error("Authentication failed or was cancelled");
  }

  const { code, state } = response.params ?? {};

  if (!code) {
    throw new Error("Missing authorization code");
  }

  if (!state) {
    throw new Error("Missing OAuth state");
  }

  if (expectedState && state !== expectedState) {
    throw new Error("Invalid OAuth state (possible CSRF)");
  }
  /*const usedStates = new Set<string>();

  if (usedStates.has(state)) {
    throw new Error("Replay attack detected");
  }

  usedStates.add(state);
  */
}
