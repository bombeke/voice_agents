import { NativeModule, requireNativeModule } from "expo";

import { VisionCameraExecutorchModuleEvents } from "./VisionCameraExecutorch.types";

declare class VisionCameraExecutorchModule extends NativeModule<VisionCameraExecutorchModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  forward(input: Float32Array): Float32Array;
  loadModel(path: string): void;
    /**
   * Forward pass on an image.
   * @param imageUri Local file URI (e.g., "file://..." or asset URI)
   * @param resizeWidth Optional resize width
   * @param resizeHeight Optional resize height
   */
  forwardBitmap(
    imageUri: string | Float32Array,
    resizeWidth?: number,
    resizeHeight?: number
  ): Float32Array;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<VisionCameraExecutorchModule>(
  "VisionCameraExecutorch",
);
