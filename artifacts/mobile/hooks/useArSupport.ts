import { isARSupportedOnDevice } from "@reactvision/react-viro";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export type ArSupport = "checking" | "supported" | "unsupported";

/**
 * Whether this device can run ARCore / ARKit. Devices without it capture with
 * the plain camera and record the phone's own position.
 */
export function useArSupport(): ArSupport {
  const [support, setSupport] = useState<ArSupport>(
    Platform.OS === "web" ? "unsupported" : "checking",
  );
  useEffect(() => {
    if (Platform.OS === "web") return;
    let live = true;
    isARSupportedOnDevice()
      .then(
        (r) =>
          live && setSupport(r?.isARSupported ? "supported" : "unsupported"),
      )
      .catch(() => live && setSupport("unsupported"));
    return () => {
      live = false;
    };
  }, []);
  return support;
}
