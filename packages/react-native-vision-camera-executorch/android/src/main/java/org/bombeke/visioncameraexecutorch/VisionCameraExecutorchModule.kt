package org.bombeke.visioncameraexecutorch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy


class VisionCameraExecutorchModule : Module() {
 
    init {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
            "detectTags"
        ) { proxy: VisionCameraProxy?, options: Map<String?, Any?>? ->
            TagsDetectorFrameProcessor(proxy, options)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("VisionCameraExecutorch")
    }
}
