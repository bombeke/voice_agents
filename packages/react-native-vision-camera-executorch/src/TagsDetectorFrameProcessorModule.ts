import { NativeModule, requireNativeModule } from "expo";
import { TagsDetectorFrameProcessorModuleEvents } from "./TagsDetectorFrameProcessor.types";

declare class TagsDetectorFrameProcessorModule extends NativeModule<TagsDetectorFrameProcessorModuleEvents> {}

export default requireNativeModule<TagsDetectorFrameProcessorModule>(
  "TagsDetectorFrameProcessor",
);
