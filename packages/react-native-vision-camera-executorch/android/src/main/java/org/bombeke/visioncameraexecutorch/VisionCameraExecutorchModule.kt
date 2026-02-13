package org.bombeke.visioncameraexecutorch

import android.graphics.Bitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import org.pytorch.executorch.Module as ETModule
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue
import java.net.URL

class VisionCameraExecutorchModule : Module() {
    private var module: ETModule? = null

    init {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
            "detectTags"
        ) { proxy: VisionCameraProxy, options: Map<String?, Any?>? ->
            TagsDetectorFrameProcessor(requireNotNull(proxy), options)
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

        // ===== Forward using raw FloatArray =====
        Function("forward") { input: DoubleArray, height: Int, width: Int ->
            val m = module ?: throw IllegalStateException("Model not loaded. Call loadModel(path) first.")

            if (input.size != height * width * 3) {
                throw IllegalArgumentException("Input length does not match height*width*3")
            }

            val inputData = FloatArray(input.size) { i -> input[i].toFloat() }
            val shape = longArrayOf(1, 3, height.toLong(), width.toLong())
            val inputTensor = Tensor.fromBlob(inputData, shape)

            val outputTensor = m.forward(EValue.from(inputTensor))[0].toTensor()
            outputTensor.getDataAsFloatArray.toList()
        }

        // ===== Bitmap helper =====
        Function("forwardBitmap") { bitmap: Bitmap, resizeWidth: Int?, resizeHeight: Int? ->
            val m = module ?: throw IllegalStateException("Model not loaded. Call loadModel(path) first.")

            val resized = if (resizeWidth != null && resizeHeight != null) {
                Bitmap.createScaledBitmap(bitmap, resizeWidth, resizeHeight, true)
            } else bitmap

            val width = resized.width
            val height = resized.height
            val floatArray = FloatArray(3 * width * height)
            val pixels = IntArray(width * height)
            resized.getPixels(pixels, 0, width, 0, 0, width, height)

            for (y in 0 until height) {
                for (x in 0 until width) {
                    val idx = y * width + x
                    val pixel = pixels[idx]
                    val r = ((pixel shr 16) and 0xFF) / 255.0f
                    val g = ((pixel shr 8) and 0xFF) / 255.0f
                    val b = (pixel and 0xFF) / 255.0f

                    floatArray[idx] = r
                    floatArray[width * height + idx] = g
                    floatArray[2 * width * height + idx] = b
                }
            }

            val shape = longArrayOf(1, 3, height.toLong(), width.toLong())
            val inputTensor = Tensor.fromBlob(floatArray, shape)
            val outputTensor = m.forward(EValue.from(inputTensor))[0].toTensor()
            outputTensor.getDataAsFloatArray.toList()
        }

        View(VisionCameraExecutorchView::class) {
            Prop("url") { view: VisionCameraExecutorchView, url: URL ->
                view.webView.loadUrl(url.toString())
            }
            Events("onLoad")
        }
    }
}
