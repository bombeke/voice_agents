import { NativeModule, requireNativeModule } from "expo";

import { VisionCameraExecutorchModuleEvents } from "./VisionCameraExecutorch.types";

declare class VisionCameraExecutorchModule extends NativeModule<VisionCameraExecutorchModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  forward(input: Float32Array): Float32Array;
  loadModel(path: string): void;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<VisionCameraExecutorchModule>(
  "VisionCameraExecutorch",
);
