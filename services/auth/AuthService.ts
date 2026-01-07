
import { IClaims } from "@/providers/AuthProvider";
import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import { jwtDecode } from "jwt-decode";
import { axiosClient } from "../Api";
import { clearAuth, getExpiry, getToken, saveClaims, saveExpiry, saveToken } from "./AuthStorage";

import { AuthSessionResult } from "expo-auth-session";


/**
 * Refresh the current session token using Casdoor refresh token or code
 * Returns true if session successfully refreshed
 * Returns false if token could not be refreshed
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      console.warn("Offline, cannot refresh session");
      return false;
    }

    const token = await getToken();
    const expiry = await getExpiry();

    if (!token || !expiry) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    if (expiry > now + 30) {
      return true;
    }

    const res = await axiosClient.post("/refresh", { token });

    if (!res.data?.token || !res.data?.access_token) {
      await clearAuth();
      return false;
    }

    const newToken = res.data.token || res.data.access_token;
    const decoded: IClaims = jwtDecode(newToken);

    const newExpiry = decoded.exp;
    await saveToken(newToken);
    await saveExpiry(newExpiry);
    saveClaims(decoded);

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
  returnedUrl: string
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
  expectedState?: string
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
}
