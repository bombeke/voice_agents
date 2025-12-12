import * as Crypto from "expo-crypto";
import { CryptoDigestAlgorithm } from "expo-crypto";

// Ensure global.crypto exists
if (typeof global.crypto === "undefined") {
  // @ts-ignore
  global.crypto = {};
}

if (typeof global.crypto.subtle === "undefined") {
  // @ts-ignore
  global.crypto.subtle = {
    async digest(algorithm: string | CryptoDigestAlgorithm, data: ArrayBuffer) {
      // Normalize algorithm to Expo format
      const algo = typeof algorithm === "string" ? algorithm.toUpperCase() : algorithm;

      const supported = [
        "SHA-1",
        "SHA-256",
        "SHA-384",
        "SHA-512",
        "MD5"
      ];

      if (!supported.includes(algo)) {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // expo-crypto accepts ArrayBuffer directly
      const hashBuffer = await Crypto.digest(algo as CryptoDigestAlgorithm, data);

      // Return ArrayBuffer to match WebCrypto spec
      return hashBuffer;
    }
  };
}
