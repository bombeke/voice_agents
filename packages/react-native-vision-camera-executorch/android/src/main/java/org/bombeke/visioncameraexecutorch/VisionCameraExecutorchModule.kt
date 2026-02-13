package org.bombeke.visioncameraexecutorch

import android.graphics.Bitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import org.pytorch.executorch.Module as ETModule
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue

class VisionCameraExecutorchModule : Module() {
    private var module: ETModule? = null

    init {
        // Register Vision Camera Frame Processor plugin
        FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectTags") { proxy: VisionCameraProxy?, options: Map<String?, Any?>? ->
            TagsDetectorFrameProcessor(proxy, options)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("VisionCameraExecutorch")

        Constant("PI") { Math.PI }

        Events("onChange")

        Function("hello") { "Hello world! 👋" }

        AsyncFunction("setValueAsync") { value: String ->
            sendEvent("onChange", mapOf("value" to value))
        }

        Function("loadModel") { path: String ->
            module = ETModule.load(path)
        }

        // Forward function for precomputed FloatArray [1,3,H,W]
        Function("forward") { input: FloatArray, height: Int, width: Int ->
            val m = module ?: throw IllegalStateException("Model not loaded. Call loadModel(path) first.")

            if (input.size != height * width * 3) {
                throw IllegalArgumentException("Input length does not match height*width*3")
            }

            val shape = longArrayOf(1, 3, height.toLong(), width.toLong())
            val inputTensor = Tensor.fromBlob(input, shape)

            val outputTensor = m.forward(EValue.from(inputTensor))[0].toTensor()
            outputTensor.dataAsFloatArray
        }

        // Helper: convert Bitmap to FloatArray in CHW order with optional resize
        Function("bitmapToFloatArray") { bitmap: Bitmap, resizeWidth: Int?, resizeHeight: Int? ->
            val resizedBitmap = if (resizeWidth != null && resizeHeight != null) {
                Bitmap.createScaledBitmap(bitmap, resizeWidth, resizeHeight, true)
            } else bitmap

            val width = resizedBitmap.width
            val height = resizedBitmap.height
            val pixels = IntArray(width * height)
            resizedBitmap.getPixels(pixels, 0, width, 0, 0, width, height)

            val floatArray = FloatArray(3 * width * height)
            for (y in 0 until height) {
                for (x in 0 until width) {
                    val idx = y * width + x
                    val pixel = pixels[idx]
                    floatArray[idx] = ((pixel shr 16) and 0xFF) / 255.0f       // R
                    floatArray[width * height + idx] = ((pixel shr 8) and 0xFF) / 255.0f // G
                    floatArray[2 * width * height + idx] = (pixel and 0xFF) / 255.0f     // B
                }
            }
            floatArray
        }

        // Forward function that accepts Bitmap directly, synchronous
        Function("forwardBitmap") { bitmap: Bitmap, resizeWidth: Int?, resizeHeight: Int? ->
            val m = module ?: throw IllegalStateException("Model not loaded. Call loadModel(path) first.")

            val floatArray = call("bitmapToFloatArray", bitmap, resizeWidth, resizeHeight) as FloatArray
            val width = if (resizeWidth != null) resizeWidth else bitmap.width
            val height = if (resizeHeight != null) resizeHeight else bitmap.height

            val shape = longArrayOf(1, 3, height.toLong(), width.toLong())
            val inputTensor = Tensor.fromBlob(floatArray, shape)

            val outputTensor = m.forward(EValue.from(inputTensor))[0].toTensor()
            outputTensor.dataAsFloatArray
        }

        // Optional native view support
        View(VisionCameraExecutorchView::class) {
            Prop("url") { view: VisionCameraExecutorchView, url: URL ->
                view.webView.loadUrl(url.toString())
            }
            Events("onLoad")
        }
    }
}
