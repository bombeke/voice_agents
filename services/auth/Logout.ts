import { API_URL } from "@/constants/Config";
import * as WebBrowser from "expo-web-browser";

export async function casdoorLogout() {
  await WebBrowser.openBrowserAsync(`${API_URL}/logout`);
}
