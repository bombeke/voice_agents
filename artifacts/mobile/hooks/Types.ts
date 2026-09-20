import { CocoLabelYolo } from "@/constants/Enum";
import type { LocationObject } from "expo-location";
import { Detection } from "react-native-executorch";
import { CameraPhotoOutput } from "react-native-vision-camera";

export interface ITakePhotoProps {
  flashMode?: "off" | "on";
  detections: TrackedDetection[]
  /** Latest fix from the capture accuracy gate; avoids a second GPS read. */
  position?: LocationObject | null
}

export interface ICameraOutputs {
  photoOutput: CameraPhotoOutput
}

/**
 * A photo that has been taken and geotagged but not yet committed: it waits in
 * memory while the surveyor fills in the tag form, and is discarded on retake.
 */
export interface PendingCapture {
  /** Path returned by the camera; run it through toFileUri() before display. */
  imageUri: string;
  latitude: number;
  longitude: number;
  /** Accuracy radius (m) of the fix that passed the capture gate. */
  accuracy: number | null;
  timestamp: number;
  detections: TrackedDetection[];
}

export interface ISavePoleProps {
  capture: PendingCapture;
  tag: string;
  comment?: string;
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
