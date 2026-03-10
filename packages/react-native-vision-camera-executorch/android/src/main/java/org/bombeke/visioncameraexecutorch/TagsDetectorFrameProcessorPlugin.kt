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
        private const val CONF_THRESHOLD = 0.5f
        private const val IOU_THRESHOLD = 0.55f
        private const val DETECTION_SCORE_THRESHOLD = .7f
        private const val DEFAULT_MODEL_ASSET = "yolo26n.pte"
        private const val OPTIONS_MODEL_PATH_KEY = "modelPath"   // local absolute path
        private const val OPTIONS_MODEL_URL_KEY  = "modelUrl"    // remote URL to download from
    }

    private var heightRatio: Float = 1.0f
    private var widthRatio: Float = 1.0f
    private var numClasses: Int = 0
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
    private val inputTensorBuffer =
    FloatArray(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE)

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
        
        Log.d(TAG, "Detected ${detections.size} object(s)")
        val detectionsList = detections.map { det ->
            mapOf(
                "x1" to det.bbox.x1.toDouble(),
                "y1" to det.bbox.y1.toDouble(),
                "x2" to det.bbox.x2.toDouble(),
                "y2" to det.bbox.y2.toDouble(),
                "score" to det.score.toDouble(),
                "classId" to det.label.id,
                "name" to det.label.name
            )
        }

        return mapOf(
            "detections" to detectionsList,
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
        widthRatio = image.width.toFloat() / MODEL_INPUT_SIZE
        heightRatio = image.height.toFloat() / MODEL_INPUT_SIZE

        val floatInput = yuv420ToNchwFloat(image)

        val inputTensor = Tensor.fromBlob(
            floatInput,
            longArrayOf(1, 3, MODEL_INPUT_SIZE.toLong(), MODEL_INPUT_SIZE.toLong())
        )
 
        val outputs     = module.forward(EValue.from(inputTensor))

        val endTime = System.currentTimeMillis()
        Log.d(TAG, "Inference took: ${endTime - startTime} ms")
        return postprocess(outputs)
    }


    fun postprocess(output: Array<EValue>): List<Detection> {

        val outputTensor = output[0].toTensor()
        val raw = outputTensor.dataAsFloatArray
        val shape = outputTensor.shape()

        val numAnchors = shape[2].toInt()
        val channels = shape[1].toInt()
        

        if (numClasses == 0) {
            numClasses = channels - 4
            Log.d(TAG, "Detected numClasses = $numClasses")
        }

        val detections = mutableListOf<Detection>()

        for (a in 0 until numAnchors) {

            val cx = raw[0 * numAnchors + a]
            val cy = raw[1 * numAnchors + a]
            val w  = raw[2 * numAnchors + a]
            val h  = raw[3 * numAnchors + a]

            var maxScore = 0f
            var classId = 0

            for (c in 0 until numClasses) {

                val score = raw[(4 + c) * numAnchors + a]

                if (score > maxScore) {
                    maxScore = score
                    classId = c
                }
            }

            if (maxScore < CONF_THRESHOLD) continue

            val x1 = (cx - w / 2f) * widthRatio
            val y1 = (cy - h / 2f) * heightRatio
            val x2 = (cx + w / 2f) * widthRatio
            val y2 = (cy + h / 2f) * heightRatio

            val bbox = Bbox(x1, y1, x2, y2)

            val label = CocoLabel.fromId(classId) ?: continue

            detections.add(
                Detection(
                    bbox = bbox,
                    score = maxScore,
                    label = label
                )
            )
        }

        return nms(detections, IOU_THRESHOLD)
    }
    
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

        val buffer = inputTensorBuffer
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

                buffer[rOffset + idx] = r
                buffer[gOffset + idx] = g
                buffer[bOffset + idx] = b
            }
        }

        return buffer
    }
}
