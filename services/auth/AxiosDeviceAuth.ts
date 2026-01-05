import type { AxiosInstance } from "axios";
import { signRequest } from "./DeviceSigner";

export function attachDeviceAuth(axios: AxiosInstance) {
  axios.interceptors.request.use(async (config) => {
    const { signature, timestamp, nonce, fingerprint } =
      await signRequest(
        config.method ?? "GET",
        config.url ?? "",
        config.data
      );

      config.headers.set("X-Device-Signature",signature);
      config.headers.set("X-Device-Timestamp",timestamp.toString());
      config.headers.set("X-Device-Nonce", nonce);
      config.headers.set("X-Device-Fingerprint", fingerprint);
    

    return config;
  });
}
