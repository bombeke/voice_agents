package org.bombeke.visioncameraexecutorch

import android.media.Image
import android.util.Log
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import org.bombeke.visioncameraexecutorch.utils.Bbox
import org.bombeke.visioncameraexecutorch.utils.CocoLabel
import org.bombeke.visioncameraexecutorch.utils.Detection
import org.bombeke.visioncameraexecutorch.utils.nms
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import org.pytorch.executorch.EValue
import java.io.File
import kotlin.math.max
import kotlin.math.min
import com.facebook.react.bridge.ReactApplicationContext
import java.io.FileOutputStream
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray

class TagsDetectorFrameProcessorPlugin(
    proxy: VisionCameraProxy?,
    options: Map<String, Any>?
) : FrameProcessorPlugin() {


    companion object {
        private const val TAG = "TagsDetectorPlugin"
        private const val MODEL_INPUT_SIZE = 640
        private const val NUM_CLASSES = 80
        private const val CONF_THRESHOLD = 0.25f
        private const val IOU_THRESHOLD = 0.55f
        private const val DETECTION_SCORE_THRESHOLD = .7f
        private const val DEFAULT_MODEL_ASSET = "yolo26n.pte"
        private const val OPTIONS_MODEL_PATH_KEY = "modelPath"   // local absolute path
        private const val OPTIONS_MODEL_URL_KEY  = "modelUrl"    // remote URL to download from
    }

    /*data class Detection(
        val x1: Float, val y1: Float,
        val x2: Float, val y2: Float,
        val confidence: Float,
        val classId: Int
    )*/

    private var heightRatio: Float = 1.0f
    private var widthRatio: Float = 1.0f
    private val INPUT_SIZE = 640
    private val floatBuffer =
        FloatArray(1 * 3 * INPUT_SIZE * INPUT_SIZE)
    private val module: Module
    private val reactContext: ReactApplicationContext
    private val MODEL_NAME = "model.pte"
    private var modelPath: String = ""
    private val rChannel = FloatArray(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE) { 0.5f }
    private val gChannel = FloatArray(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE) { 0.5f }
    private val bChannel = FloatArray(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE) { 0.5f }

    init {
        Log.d(TAG, "Initializing with options: ${options?.toString()}")

        requireNotNull(proxy) { "VisionCameraProxy cannot be null" }

        reactContext = proxy.context //as ReactApplicationContext
        modelPath = prepareModel(reactContext)
        Log.v(TAG, "Model file loaded: " + modelPath);
       // val modelFile = resolveModelFile(options)

        module = Module.load( modelPath )
        //Log.d(TAG, "Model loaded from ${modelFile.absolutePath}")
    }

    override fun callback(frame: Frame , params: Map<String, Any>?): Any? {

        val image = frame.image
        Log.d(TAG, "${image.width} x ${image.height} image, format #${image.format}")

        val detections = runInference(image)
        
        /*val detectionList = detections.map { det ->
            hashMapOf<String, Any>(
                "x1"         to det.x1.toDouble(),
                "y1"         to det.y1.toDouble(),
                "x2"         to det.x2.toDouble(),
                "y2"         to det.y2.toDouble(),
                "confidence" to det.confidence.toDouble(),
                "classId"    to det.classId
            )
        }*/
        val outputArray: WritableArray = Arguments.createArray()
        detections.forEach { detection ->
            outputArray.pushMap(detection.toWritableMap())
        }
        Log.d(TAG, "Detected ${detections.size} object(s)")
        return hashMapOf(
            "detections" to outputArray,
            "frameWidth" to image.width,
            "frameHeight" to image.height
        )
    }

    private fun prepareModel(context:  ReactApplicationContext): String {
        val destinationFile = File(context.filesDir, MODEL_NAME)

        if (destinationFile.exists()) {
            return destinationFile.absolutePath
        }

        try {
            reactContext.assets.open(MODEL_NAME).use { inputStream ->
                FileOutputStream(destinationFile).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        } 
        catch (e: Exception) {
            e.printStackTrace()
            return ""
        }

        return destinationFile.absolutePath
    }
    private fun resolveModelFile(options: Map<String, Any>?): File {

        val modelPath = options?.get(OPTIONS_MODEL_PATH_KEY) as? String
            ?: throw IllegalArgumentException(
                "modelPath must be provided from JS using expo-asset localUri"
            )

        val modelFile = File(modelPath)

        if (!modelFile.exists()) {
            throw IllegalArgumentException(
                "Model file does not exist at path: $modelPath"
            )
        }

        Log.d(TAG, "Using model file at $modelPath")

        return modelFile
    }

    private fun downloadFile(url: String, dest: File) {
        val client   = okhttp3.OkHttpClient()
        val request  = okhttp3.Request.Builder().url(url).build()
        val response = client.newCall(request).execute()

        if (!response.isSuccessful) {
            throw RuntimeException("Failed to download model: HTTP ${response.code} from $url")
        }

        response.body?.byteStream()?.use { input ->
            dest.outputStream().use { input.copyTo(it) }
        } ?: throw RuntimeException("Empty response body downloading model from $url")

        Log.d(TAG, "Model downloaded successfully to ${dest.absolutePath}")
    }

    // ------------------------------------------------------------
    // Zero-Copy YUV → Float
    // ------------------------------------------------------------

    private fun processImage(image: Image) {

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer

        val width = image.width
        val height = image.height

        val yRowStride = yPlane.rowStride
        val uvRowStride = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride

        val scale = min(
            INPUT_SIZE.toFloat() / width,
            INPUT_SIZE.toFloat() / height
        )

        val resizedW = (width * scale).toInt()
        val resizedH = (height * scale).toInt()

        val padX = (INPUT_SIZE - resizedW) / 2
        val padY = (INPUT_SIZE - resizedH) / 2

        val padValue = 114f / 255f

        // Fill padding
        for (i in floatBuffer.indices) {
            floatBuffer[i] = padValue
        }

        for (y in 0 until height) {
            for (x in 0 until width) {

                val yIndex = y * yRowStride + x
                val uvIndex =
                    (y / 2) * uvRowStride +
                    (x / 2) * uvPixelStride

                val Y = yBuffer.get(yIndex).toInt() and 0xFF
                val U = uBuffer.get(uvIndex).toInt() and 0xFF
                val V = vBuffer.get(uvIndex).toInt() and 0xFF

                var r = Y + (1.370705f * (V - 128)).toInt()
                var g = Y - (0.337633f * (U - 128)).toInt() -
                        (0.698001f * (V - 128)).toInt()
                var b = Y + (1.732446f * (U - 128)).toInt()

                r = r.coerceIn(0, 255)
                g = g.coerceIn(0, 255)
                b = b.coerceIn(0, 255)

                val newX = (x * scale).toInt() + padX
                val newY = (y * scale).toInt() + padY

                if (newX in 0 until INPUT_SIZE &&
                    newY in 0 until INPUT_SIZE) {

                    val index =
                        newY * INPUT_SIZE + newX

                    floatBuffer[index] =
                        r / 255f

                    floatBuffer[index +
                        INPUT_SIZE * INPUT_SIZE] =
                        g / 255f

                    floatBuffer[index +
                        2 * INPUT_SIZE * INPUT_SIZE] =
                        b / 255f
                }
            }
        }
    }

    private fun runInference(image: Image): List<Detection> {
        val startTime = System.currentTimeMillis()
        val floatInput  = yuv420ToNchwFloat(image)
        val inputTensor = Tensor.fromBlob(
            floatInput,
            longArrayOf(1, 3, MODEL_INPUT_SIZE.toLong(), MODEL_INPUT_SIZE.toLong())
        )
 
        val outputs     = module.forward(EValue.from(inputTensor))

        val endTime = System.currentTimeMillis()
        Log.d(TAG, "Inference took: ${endTime - startTime} ms")
        return postprocess(outputs)

        /*
        val outputTensor = outputs[0].toTensor()
        val rawData     = outputTensor.dataAsFloatArray

        val shape       = outputTensor.shape()   // [1, 84, 8400]

        val numAnchors  = shape[2].toInt()
        val srcW        = image.width.toFloat()
        val srcH        = image.height.toFloat()
        val scale       = MODEL_INPUT_SIZE / max(srcW, srcH)
        val padL        = (MODEL_INPUT_SIZE - srcW * scale) / 2f
        val padT        = (MODEL_INPUT_SIZE - srcH * scale) / 2f

        val detections  = mutableListOf<Detection>()

        for (a in 0 until numAnchors) {
            val cx = rawData[0 * numAnchors + a]
            val cy = rawData[1 * numAnchors + a]
            val w  = rawData[2 * numAnchors + a]
            val h  = rawData[3 * numAnchors + a]

            var maxScore = 0f
            var classId  = 0
            for (c in 0 until NUM_CLASSES) {
                val score = rawData[(4 + c) * numAnchors + a]
                if (score > maxScore) { maxScore = score; classId = c }
            }

            if (maxScore < CONF_THRESHOLD) continue

            // Model-input coords → original image coords
            val x1 = ((cx - w / 2f - padL) / scale).coerceIn(0f, srcW)
            val y1 = ((cy - h / 2f - padT) / scale).coerceIn(0f, srcH)
            val x2 = ((cx + w / 2f - padL) / scale).coerceIn(0f, srcW)
            val y2 = ((cy + h / 2f - padT) / scale).coerceIn(0f, srcH)

            detections.add(Detection(x1, y1, x2, y2, maxScore, classId))
        }

        return nonMaxSuppression(detections)
        */
    }
    fun postprocess(output: Array<EValue>): List<Detection> {
        val scoresTensor = output[1].toTensor()
        val numel = scoresTensor.numel()
        val bboxes = output[0].toTensor().dataAsFloatArray
        val scores = scoresTensor.dataAsFloatArray
        val labels = output[2].toTensor().dataAsFloatArray

        //val detections: MutableList<Detection> = mutableListOf()
        val detections = mutableListOf<Detection>()
        for (idx in 0 until numel.toInt()) {
        val score = scores[idx]
        if (score < DETECTION_SCORE_THRESHOLD) {
            continue
        }
        /*val bbox =
            Bbox(
            bboxes[idx * 4 + 0] * widthRatio,
            bboxes[idx * 4 + 1] * heightRatio,
            bboxes[idx * 4 + 2] * widthRatio,
            bboxes[idx * 4 + 3] * heightRatio,
            )
        val label = labels[idx]
        detections.add(
            Detection(bbox, score, CocoLabel.fromId(label.toInt())!!),
        )
        }*/
        
        val x1 = bboxes[idx * 4 + 0] * widthRatio
        val y1 = bboxes[idx * 4 + 1] * heightRatio
        val x2 = bboxes[idx * 4 + 2] * widthRatio
        val y2 = bboxes[idx * 4 + 3] * heightRatio

        val bbox = Bbox(x1, y1, x2, y2)

        val labelId = labels[idx].toInt()
        val label = CocoLabel.fromId(labelId) ?: continue

        detections.add(
            Detection(
                bbox = bbox,
                score = score,
                label = label
            )
        )

        val detectionsPostNms = nms(detections, IOU_THRESHOLD)
        return detectionsPostNms.toTypedArray()
    }

    // ── YUV_420_888 (format 35) → float NCHW [1,3,640,640] ─────────────────
    private fun yuv420ToNchwFloat(image: Image): FloatArray {
        val yPlane  = image.planes[0]
        val uPlane  = image.planes[1]
        val vPlane  = image.planes[2]

        val yBuffer       = yPlane.buffer
        val uBuffer       = uPlane.buffer
        val vBuffer       = vPlane.buffer
        val yRowStride    = yPlane.rowStride
        val uvRowStride   = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride

        val srcW     = image.width
        val srcH     = image.height
        val scale    = MODEL_INPUT_SIZE.toFloat() / max(srcW, srcH)
        val scaledW  = (srcW * scale).toInt()
        val scaledH  = (srcH * scale).toInt()
        val padTop   = (MODEL_INPUT_SIZE - scaledH) / 2
        val padLeft  = (MODEL_INPUT_SIZE - scaledW) / 2

        for (dstY in 0 until scaledH) {
            val srcY   = (dstY / scale).toInt().coerceIn(0, srcH - 1)
            val uvRow  = (srcY / 2) * uvRowStride

            for (dstX in 0 until scaledW) {
                val srcX  = (dstX / scale).toInt().coerceIn(0, srcW - 1)
                val uvCol = (srcX / 2) * uvPixelStride

                val yVal = (yBuffer[srcY * yRowStride + srcX].toInt() and 0xFF).toFloat()
                val uVal = (uBuffer[uvRow + uvCol].toInt() and 0xFF).toFloat() - 128f
                val vVal = (vBuffer[uvRow + uvCol].toInt() and 0xFF).toFloat() - 128f

                // BT.601 YUV → RGB, normalise to [0, 1]
                val r = (yVal + 1.370705f * vVal).coerceIn(0f, 255f) / 255f
                val g = (yVal - 0.698001f * vVal - 0.337633f * uVal).coerceIn(0f, 255f) / 255f
                val b = (yVal + 1.732446f * uVal).coerceIn(0f, 255f) / 255f

                val idx = (padTop + dstY) * MODEL_INPUT_SIZE + (padLeft + dstX)
                rChannel[idx] = r
                gChannel[idx] = g
                bChannel[idx] = b
            }
        }

        // Concatenate R, G, B planes → NCHW flat array [1, 3, 640, 640]
        return rChannel + gChannel + bChannel
    }

}
