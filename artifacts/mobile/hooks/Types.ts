import { CocoLabelYolo } from "@/constants/Enum";
import type { LocationObject } from "expo-location";
import { Detection } from "react-native-executorch";
import { CameraPhotoOutput } from "react-native-vision-camera";

export interface ITakePhotoProps {
  flashMode?: "off" | "on";
  detections: TrackedDetection[]
  /** Latest fix from the capture distance gate; avoids a second GPS read. */
  position?: LocationObject | null
}

export interface ICameraOutputs {
  photoOutput: CameraPhotoOutput
}

export type TrackedDetection = Detection<typeof CocoLabelYolo> & {
  trackId: number;
};

export interface Track extends TrackedDetection {
  vx: number;
  vy: number;
  age: number;
  hits: number;
};

export interface InferInterface {
  modelName: string;
  modelSource?: string;
}
