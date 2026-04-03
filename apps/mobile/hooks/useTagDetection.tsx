import { useState } from "react";
import { useSharedValue, Worklets } from "react-native-worklets-core";

export interface DetectionBox {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  label: string;
  confidence: number;
}
export interface  Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  classId: number;
  name: string;
};

export function useTagDetection(enabled: boolean) {
  const [detections, setDetections] = useState<Detection[] | any>([]);
  const lastTimestamp = useSharedValue(0);
  //const { resize } = useResizePlugin();

  const updateDetections = Worklets.createRunOnJS(
    (data: Detection[] | any) => {
      setDetections(data);
      return data;
    },
  );

  return {
    detections,
  };
}
