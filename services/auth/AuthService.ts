
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
    // 1️⃣ Check network connectivity
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      console.warn("Offline, cannot refresh session");
      return false;
    }

    // 2️⃣ Get current token and expiry
    const token = await getToken();
    const expiry = await getExpiry();

    if (!token || !expiry) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    // 3️⃣ Token still valid, no refresh needed
    if (expiry > now + 30) {
      return true;
    }

    // 4️⃣ Call Casdoor backend refresh endpoint
    const res = await axiosClient.post("/refresh", { token });

    if (!res.data?.token) {
      // refresh failed → clear auth
      await clearAuth();
      return false;
    }

    // 5️⃣ Decode new token
    const newToken = res.data.token;
    const decoded: IClaims = jwtDecode(newToken);

    // 6️⃣ Save refreshed token, expiry, and claims
    const newExpiry = decoded.exp;
    await saveToken(newToken);
    await saveExpiry(newExpiry);
    await saveClaims(decoded);

    return true;
  } catch (err: any) {
    console.error("Failed to refresh session:", err);
    await clearAuth();
    return false;
  }
}
