import { API_PASSWORD, API_URL, API_USERNAME } from "@/constants/Config";
import { QueryClient } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import axios from 'axios';
import { refreshSession } from "./auth/AuthService";
import { getToken } from "./auth/AuthStorage";
//import { attachDeviceAuth } from "./auth/AxiosDeviceAuth";

export type AuthType = 
  | { kind: 'none' }
  | { kind: 'basic', username: string, password: string }
  | { kind: 'bearer', token: string }
  | { kind: 'oauth2', accessToken: string };

export const axiosClient = axios.create({
  baseURL: `${API_URL}`,
  //timeout: 20000,
  auth:{
    username: API_USERNAME,
    password: API_PASSWORD,
  },
  headers: { 
    'Content-Type': 'application/json'
  },

});

export function applyAuthConfig(auth: AuthType) {
  // Clear previous auth
  delete axiosClient.defaults.auth;
  delete axiosClient.defaults.headers.common['Authorization'];

  switch (auth.kind) {
    case 'none':
      // No auth
      break;

    case 'basic':
      axiosClient.defaults.auth = {
        username: auth.username,
        password: auth.password
      };
      break;

    case 'bearer':
      axiosClient.defaults.headers.common['Authorization'] =
        `Bearer ${auth.token}`;
      break;

    case 'oauth2':
      axiosClient.defaults.headers.common['Authorization'] =
        `Bearer ${auth.accessToken}`;
      break;
  }
}

export function createAuthHeaders(auth: AuthType) {
  switch (auth.kind) {
    case 'none':
      return {};
    case 'basic':
      return {
        auth: {
          username: auth.username,
          password: auth.password
        }
      };
    case 'bearer':
      return {
        headers: { Authorization: `Bearer ${auth.token}` }
      };
    case 'oauth2':
      return {
        headers: { Authorization: `Bearer ${auth.accessToken}` }
      };
  }
}

/*
export async function refreshOAuthToken() {
  const auth = authStore.get();

  if (auth.kind !== "oauth2" || !auth.refreshToken) return;

  try {
    const res = await axios.post("https://your-oauth-server/token", {
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
      client_id: "xxx",
      client_secret: "yyy",
    });

    authStore.set({
      kind: "oauth2",
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
    });

  } catch (err) {
    console.log("Refresh error", err);
  }
}
*/

axiosClient.interceptors.response.use(
  r => r,
  async error => {
    if (error.response?.status === 401) {
      const ok = await refreshSession();
      if (ok) return axiosClient(error.config);
    }
    throw error;
  }
);


axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (!token) return config;

    /*const { signature, timestamp } = await signRequest(
      config.method!,
      config.url!,
      config.data
    );*/

    config.headers.set("Authorization", `Bearer ${token}`);
    //config.headers.set("X-Device-Signature", signature);
    //config.headers.set("X-Device-Timestamp", String(timestamp));
    // config.headers.set("X-Session-Id", sessionId);

    return config;
  }
);


//attachDeviceAuth(axiosClient);


export const queryClient = new QueryClient();