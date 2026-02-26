package org.bombeke.visioncameraexecutorch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

import android.util.Log

class TagsDetectorFrameProcessorModule : Module() {
 
    init {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
            "detectTags"
        ) { proxy: VisionCameraProxy?, options: Map<String, Any>? ->
            TagsDetectorFrameProcessorPlugin(proxy, options)
            
        }
        Log.d("TagsDetectorFrameProcessor", "detectTags plugin registered")
    }

    override fun definition() = ModuleDefinition {
        Name("TagsDetectorFrameProcessor")
    }
}
