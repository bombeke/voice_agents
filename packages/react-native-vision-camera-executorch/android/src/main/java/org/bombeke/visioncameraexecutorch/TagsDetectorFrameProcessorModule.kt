package org.bombeke.visioncameraexecutorch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition


import android.util.Log

class TagsDetectorFrameProcessorModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("TagsDetectorFrameProcessor")
    }
    OnCreate {
      TagsDetectorInstaller.install(appContext.reactContext)
    }
}
