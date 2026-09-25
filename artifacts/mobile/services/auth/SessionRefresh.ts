import { axiosClient } from "@/services/Api";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { isAxiosError } from "axios";
import { refreshSession } from "./AuthService";

type RetryConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

let installedOn: AxiosInstance | null = null;

/**
 * On a 401 from a non-auth endpoint, refresh the stored session and retry the
 * request once. Kept out of `Api.ts` so the client and AuthService don't
 * import each other. Safe to call more than once.
 */
export function installSessionRefresh(client: AxiosInstance = axiosClient) {
  if (installedOn === client) return;
  installedOn = client;

  client.interceptors.response.use(
    (r) => r,
    async (error: unknown) => {
      if (!isAxiosError(error) || !error.config) throw error;
      const config: RetryConfig = error.config;
      // Auth endpoints answer 401 for bad credentials; refreshing can't help.
      const isAuthCall = String(config.url ?? "").startsWith("/auth/");
      if (
        error.response?.status === 401 &&
        !isAuthCall &&
        !config._authRetried
      ) {
        config._authRetried = true;
        if (await refreshSession()) return client(config);
      }
      throw error;
    },
  );
}
