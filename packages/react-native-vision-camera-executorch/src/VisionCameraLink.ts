import type { Frame } from "react-native-vision-camera";

import "@/types/nitro";

export function detectTags(
  frame: Frame,
  options?: Record<string, any>
) {
  "worklet";

  const plugin = global.__detectTags;

  if (!plugin) {
    console.log("detectTags plugin not installed");
    return null;
  }

  return plugin.detectTags(frame, options ?? {});
}