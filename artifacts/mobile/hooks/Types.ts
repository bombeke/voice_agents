import { CocoLabelYolo } from "@/constants/Enum";
import { Detection } from "react-native-executorch";
import { CameraPhotoOutput } from "react-native-vision-camera";

export interface ITakePhotoProps {
  flashMode?: "off" | "on";
  detections: TrackedDetection[]
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
