import { NativeModule, requireNativeModule } from "expo";
import { VisionCameraExecutorchModuleEvents } from "./VisionCameraExecutorch.types";

declare class VisionCameraExecutorchModule extends NativeModule<VisionCameraExecutorchModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  forward(input: number[], height: number, width: number): number[];
  loadModel(path: string): void;
  forwardBitmap(bitmap: any, resizeWidth?: number, resizeHeight?: number): number[];
}

export default requireNativeModule<VisionCameraExecutorchModule>("VisionCameraExecutorch");
