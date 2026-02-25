import { NativeModule, requireNativeModule } from "expo";
import { VisionCameraExecutorchModuleEvents } from "./VisionCameraExecutorch.types";

declare class VisionCameraExecutorchModule extends NativeModule<VisionCameraExecutorchModuleEvents> {}

export default requireNativeModule<VisionCameraExecutorchModule>(
  "VisionCameraExecutorch",
);
