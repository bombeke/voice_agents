import type { Frame } from "react-native-vision-camera";

export interface DetectTagsPlugin {
  detectTags(
    frame: Frame,
    options?: Record<string, any>
  ): {
    detections: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      score: number;
      classId: number;
      name: string;
    }>;
    frameWidth: number;
    frameHeight: number;
  } | null;
}

declare global {
  var __detectTags: DetectTagsPlugin | undefined;
}