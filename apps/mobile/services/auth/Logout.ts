import { API_URL } from "@/constants/Config";
import { openBrowserAsync } from "expo-web-browser";

export async function casdoorLogout() {
  await openBrowserAsync(`${API_URL}/auth/logout`);
}
