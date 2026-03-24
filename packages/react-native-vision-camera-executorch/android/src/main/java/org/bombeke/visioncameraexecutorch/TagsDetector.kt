package org.bombeke.visioncameraexecutorch

import android.content.Context
import android.media.Image
import android.util.Log
import org.bombeke.visioncameraexecutorch.utils.Bbox
import org.bombeke.visioncameraexecutorch.utils.CocoLabel
import org.bombeke.visioncameraexecutorch.utils.Detection
import org.bombeke.visioncameraexecutorch.utils.nms
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

object TagsDetector {

    private const val TAG = "TagsDetector"

    // Model config
    private const val MODEL_INPUT_SIZE = 640
    private const val CONF_THRESHOLD = 0.5f
    private const val IOU_THRESHOLD = 0.55f

    private const val MODEL_NAME = "model.pte"

    // Runtime
    private var module: Module? = null
    private var isInitialized = false

    // Ratios
    private var widthRatio: Float = 1f
    private var heightRatio: Float = 1f

    // Buffers (REUSED → critical for 60 FPS)
    private val inputBuffer =
        FloatArray(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE)

    private var numClasses = 0

    // --------------------------------------------------
    // Initialization
    // --------------------------------------------------

    @Synchronized
    fun initialize(context: Context) {
        if (isInitialized) return

        val modelPath = prepareModel(context)
        module = Module.load(modelPath)

        isInitialized = true
        Log.d(TAG, "Model initialized: $modelPath")
    }

    private fun prepareModel(context: Context): String {
        val file = File(context.filesDir, MODEL_NAME)

        if (file.exists()) return file.absolutePath

        context.assets.open(MODEL_NAME).use { input ->
            FileOutputStream(file).use { output ->
                input.copyTo(output)
            }
        }

        return file.absolutePath
    }

    // --------------------------------------------------
    // Entry Point (called from JSI)
    // --------------------------------------------------

    fun detect(image: Image): Map<String, Any> {
        if (!isInitialized) {
            throw IllegalStateException("TagsDetector not initialized")
        }

        val detections = runInference(image)

        val result = detections.map {
            mapOf(
                "x1" to it.bbox.x1,
                "y1" to it.bbox.y1,
                "x2" to it.bbox.x2,
                "y2" to it.bbox.y2,
                "score" to it.score,
                "classId" to it.label.id,
                "name" to it.label.name
            )
        }

        return mapOf(
            "detections" to result,
            "frameWidth" to image.width,
            "frameHeight" to image.height
        )
    }

    // --------------------------------------------------
    // Inference
    // --------------------------------------------------

    private fun runInference(image: Image): List<Detection> {
        val start = System.currentTimeMillis()

        widthRatio = image.width.toFloat() / MODEL_INPUT_SIZE
        heightRatio = image.height.toFloat() / MODEL_INPUT_SIZE

        val input = yuv420ToNchwFloat(image)

        val tensor = Tensor.fromBlob(
            input,
            longArrayOf(1, 3, MODEL_INPUT_SIZE.toLong(), MODEL_INPUT_SIZE.toLong())
        )

        val outputs = module!!.forward(EValue.from(tensor))

        val detections = postprocess(outputs)

        val end = System.currentTimeMillis()
        Log.d(TAG, "Inference: ${end - start} ms, detections=${detections.size}")

        return detections
    }

    // --------------------------------------------------
    // Postprocess (YOLO-style)
    // --------------------------------------------------

    private fun postprocess(output: Array<EValue>): List<Detection> {
        val tensor = output[0].toTensor()
        val raw = tensor.dataAsFloatArray
        val shape = tensor.shape()

        val numAnchors = shape[2].toInt()
        val channels = shape[1].toInt()

        if (numClasses == 0) {
            numClasses = channels - 4
            Log.d(TAG, "Detected numClasses=$numClasses")
        }

        val detections = mutableListOf<Detection>()

        for (a in 0 until numAnchors) {

            val cx = raw[a]
            val cy = raw[numAnchors + a]
            val w  = raw[2 * numAnchors + a]
            val h  = raw[3 * numAnchors + a]

            var bestScore = 0f
            var classId = 0

            for (c in 0 until numClasses) {
                val score = raw[(4 + c) * numAnchors + a]
                if (score > bestScore) {
                    bestScore = score
                    classId = c
                }
            }

            if (bestScore < CONF_THRESHOLD) continue

            val x1 = (cx - w / 2f) * widthRatio
            val y1 = (cy - h / 2f) * heightRatio
            val x2 = (cx + w / 2f) * widthRatio
            val y2 = (cy + h / 2f) * heightRatio

            val label = CocoLabel.fromId(classId) ?: continue

            detections.add(
                Detection(
                    bbox = Bbox(x1, y1, x2, y2),
                    score = bestScore,
                    label = label
                )
            )
        }

        return nms(detections, IOU_THRESHOLD)
    }

    // --------------------------------------------------
    // YUV → Float (Zero-copy optimized)
    // --------------------------------------------------

    private fun yuv420ToNchwFloat(image: Image): FloatArray {

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer

        val yRowStride = yPlane.rowStride
        val uvRowStride = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride

        val srcW = image.width
        val srcH = image.height

        val scale = MODEL_INPUT_SIZE.toFloat() / max(srcW, srcH)

        val scaledW = (srcW * scale).toInt()
        val scaledH = (srcH * scale).toInt()

        val padTop = (MODEL_INPUT_SIZE - scaledH) / 2
        val padLeft = (MODEL_INPUT_SIZE - scaledW) / 2

        val planeSize = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE

        val rOffset = 0
        val gOffset = planeSize
        val bOffset = planeSize * 2

        for (dstY in 0 until scaledH) {

            val srcY = (dstY / scale).toInt().coerceIn(0, srcH - 1)
            val uvRow = (srcY / 2) * uvRowStride

            for (dstX in 0 until scaledW) {

                val srcX = (dstX / scale).toInt().coerceIn(0, srcW - 1)
                val uvCol = (srcX / 2) * uvPixelStride

                val y = (yBuffer[srcY * yRowStride + srcX].toInt() and 0xFF).toFloat()
                val u = (uBuffer[uvRow + uvCol].toInt() and 0xFF) - 128f
                val v = (vBuffer[uvRow + uvCol].toInt() and 0xFF) - 128f

                val r = (y + 1.402f * v) * 0.003921569f
                val g = (y - 0.344f * u - 0.714f * v) * 0.003921569f
                val b = (y + 1.772f * u) * 0.003921569f

                val idx = (padTop + dstY) * MODEL_INPUT_SIZE + (padLeft + dstX)

                inputBuffer[rOffset + idx] = r
                inputBuffer[gOffset + idx] = g
                inputBuffer[bOffset + idx] = b
            }
        }

        return inputBuffer
    }
}