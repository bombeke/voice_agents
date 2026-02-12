package org.bombeke.visioncameraexecutorch

import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue
import java.nio.ByteBuffer

class TagsDetectorFrameProcessor(
  proxy: VisionCameraProxy,
  options: Map<String, Any>?
) : FrameProcessorPlugin() {

  private val module: Module

  init {
    val modelPath = options?.get("modelPath") as? String ?: "/data/local/tmp/model.et"
    module = Module.load(modelPath)
  }

  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    val width = frame.width
    val height = frame.height

    val yPlane = frame.planes[0]
    val buffer: ByteBuffer = yPlane.buffer
    val rowStride = yPlane.rowStride

    val input = FloatArray(width * height)

    var i = 0
    for (y in 0 until height) {
      val rowStart = y * rowStride
      for (x in 0 until width) {
        val v = buffer.get(rowStart + x).toInt() and 0xFF
        input[i++] = v / 255.0f
      }
    }

    val shape = longArrayOf(1, 1, height.toLong(), width.toLong())
    val inputTensor = Tensor.fromBlob(input, shape)

    val output = module.forward(EValue.from(inputTensor))[0].toTensor()
    val outData = output.dataAsFloatArray

    // Return first value or full array (VisionCamera supports primitives/arrays)
    return if (outData.isNotEmpty()) outData[0] else null
  }
}
