
import { IClaims } from "@/providers/AuthProvider";
import NetInfo from "@react-native-community/netinfo";
import { jwtDecode } from "jwt-decode";
import { axiosClient } from "../Api";
import { clearAuth, getExpiry, getToken, saveClaims, saveExpiry, saveToken } from "./AuthStorage";


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

    if (!res.data?.token) {
      await clearAuth();
      return false;
    }

    const newToken = res.data.token;
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
