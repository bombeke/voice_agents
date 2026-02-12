package org.bombeke.visioncameraexecutorch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import expo.modules.kotlin.typedarray.Float32Array
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

import org.pytorch.executorch.Module as ETModule
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue

class VisionCameraExecutorchModule : Module() {
   private var module: ETModule? = null
  init {
    FrameProcessorPluginRegistry.addFrameProcessorPlugin(
      "detectTags"
    ) { proxy: VisionCameraProxy?, options: Map<String?, Any?>? ->
      TagsDetectorFrameProcessor(
        proxy,
        options
      )
    }
  }
  //companion object {
  //  init {
  //    System.loadLibrary("VisionCameraExecutorch")
  //  }
  //}

  // C++ returns nothing; it modifies the output buffer in-place
  //private external fun nativeForwardZeroCopy(input: Any, output: Any, length: Int)
  
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('VisionCameraExecutorch')` in JavaScript.
    Name("VisionCameraExecutorch")

    // Defines constant property on the module.
    Constant("PI") {
      Math.PI
    }

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    Function("hello") {
      "Hello world! 👋"
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { value: String ->
      // Send an event to JavaScript.
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }

    Function("loadModel") { path: String ->
      module = ETModule.load(path)
    }
    
    Function("forward") { input: Float32Array ->
      // Ensure they are the same length to avoid crashes in C++
     // val length = minOf(input.length, output.length)
      
      //nativeForwardZeroCopy(input.directBuffer, output.directBuffer, length)
      val m = module ?: throw IllegalStateException("Model not loaded. Call loadModel(path) first.")

      // Assume input shape [1, N]
      val shape = longArrayOf(1, input.size.toLong())
      val inputTensor = Tensor.fromBlob(input, shape)

      val output = m.forward(EValue.from(inputTensor))[0].toTensor()
      val outData = output.dataAsFloatArray

      outData
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of
    // the view definition: Prop, Events.
    View(VisionCameraExecutorchView::class) {
      // Defines a setter for the `url` prop.
      Prop("url") { view: VisionCameraExecutorchView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      // Defines an event that the view can send to JavaScript.
      Events("onLoad")
    }
  }
}
