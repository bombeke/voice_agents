package org.bombeke.visioncameraexecutorch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

import android.util.Log

class VisionCameraExecutorchModule : Module() {
 
    init {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
            "detectTags"
        ) { proxy: VisionCameraProxy?, options: Map<String?, Any?>? ->
            TagsDetectorFrameProcessor(proxy, options)
            
        }
        Log.d("VisionCameraExecutorch", "detectTags plugin registered")
    }

    override fun definition() = ModuleDefinition {
        Name("VisionCameraExecutorch")
    }
}
