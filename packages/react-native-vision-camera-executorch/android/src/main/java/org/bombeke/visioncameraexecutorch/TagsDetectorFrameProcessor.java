package org.bombeke.visioncameraexecutorch;

import com.mrousavy.camera.frameprocessors.Frame;
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;
import com.mrousavy.camera.core.FrameInvalidError;

import androidx.camera.core.ImageProxy;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.pytorch.executorch.EValue;
import org.pytorch.executorch.Module;
import org.pytorch.executorch.Tensor;

import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Collections;

public class TagsDetectorFrameProcessor extends FrameProcessorPlugin {

    private final Module module;

    // ===== Model params =====
    private static final int MODEL_W = 640;
    private static final int MODEL_H = 640;
    private static final int CHANNELS = 3;

    // ===== Tuning =====
    private final int batchSize = 4;        // adjust for latency vs throughput
    private final int warmupIters = 1;       // set >1 if you want warm-up
    private final float confThreshold = 0.25f;
    private final float nmsThreshold = 0.45f;

    // ===== Buffers =====
    private FloatBuffer batchFloatBuffer = null;
    private long[] batchShape = null;

    private int framesInBatch = 0;

    public TagsDetectorFrameProcessor(@NonNull VisionCameraProxy proxy, @Nullable Map<String, Object> options) {
        super();

        String modelPath = "/data/local/tmp/model.pte";
        if (options != null && options.get("modelPath") instanceof String) {
            modelPath = (String) options.get("modelPath");
        }

        module = Module.load(modelPath);
    }

    @Nullable
    @Override
    public Object callback(@NonNull Frame frame,
                        @Nullable Map<String, Object> arguments) {

        ImageProxy image;

        try {
            image = frame.getImageProxy();
        } catch (FrameInvalidError e) {
            // Skip invalid frame
            return Collections.emptyList();
        }

        if (image == null) {
            return Collections.emptyList();
        }

        // Allocate buffers once
        if (batchFloatBuffer == null) {
            int elements = batchSize * CHANNELS * MODEL_H * MODEL_W;
            batchFloatBuffer = Tensor.allocateFloatBuffer(elements);
            batchShape = new long[]{ batchSize, CHANNELS, MODEL_H, MODEL_W };
            framesInBatch = 0;
        }

        // Preprocess this frame into batch buffer
        preprocessYUVToNCHW(image, batchFloatBuffer, framesInBatch);

        framesInBatch++;

        // If batch not ready → return empty result instead of null
        if (framesInBatch < batchSize) {
            return Collections.emptyList();
        }

        Tensor inputTensor = Tensor.fromBlob(batchFloatBuffer, batchShape);

        float[] outData = null;

        try {
            for (int i = 0; i < warmupIters; i++) {
                EValue[] outputs = module.forward(EValue.from(inputTensor));
                outData = outputs[0].toTensor().getDataAsFloatArray();
            }
        } catch (Exception e) {
            framesInBatch = 0;
            return Collections.emptyList();
        }

        framesInBatch = 0;

        if (outData == null || outData.length == 0) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> detections =
            parseYoloOutputForLastFrame(outData);

        // Never return null
        return detections != null ? detections : Collections.emptyList();
    }

    // ============================================================
    // ===================== PREPROCESS ===========================
    // ============================================================

    private void preprocessYUVToNCHW(ImageProxy image, FloatBuffer dst, int batchIndex) {
        ImageProxy.PlaneProxy[] planes = image.getPlanes();
        ByteBuffer yBuf = planes[0].getBuffer();
        ByteBuffer uBuf = planes[1].getBuffer();
        ByteBuffer vBuf = planes[2].getBuffer();

        int yRowStride = planes[0].getRowStride();
        int uvRowStride = planes[1].getRowStride();
        int uvPixelStride = planes[1].getPixelStride();

        int srcW = image.getWidth();
        int srcH = image.getHeight();

        // Letterbox params
        float scale = Math.min((float) MODEL_W / srcW, (float) MODEL_H / srcH);
        int newW = Math.round(srcW * scale);
        int newH = Math.round(srcH * scale);
        int padX = (MODEL_W - newW) / 2;
        int padY = (MODEL_H - newH) / 2;

        int pixelsPerImage = MODEL_W * MODEL_H;
        int base = batchIndex * CHANNELS * pixelsPerImage;
        int rBase = base;
        int gBase = base + pixelsPerImage;
        int bBase = base + 2 * pixelsPerImage;

        // Fill with padding color (114)
        float padVal = 114f / 255f;
        for (int i = 0; i < pixelsPerImage; i++) {
            dst.put(rBase + i, padVal);
            dst.put(gBase + i, padVal);
            dst.put(bBase + i, padVal);
        }

        // For each dest pixel in resized area, sample source (nearest neighbor)
        for (int dy = 0; dy < newH; dy++) {
            int sy = Math.min((int)(dy / scale), srcH - 1);
            int yRowStart = sy * yRowStride;
            int uvRowStart = (sy / 2) * uvRowStride;

            for (int dx = 0; dx < newW; dx++) {
                int sx = Math.min((int)(dx / scale), srcW - 1);

                int yIndex = yRowStart + sx;
                int uvIndex = uvRowStart + (sx / 2) * uvPixelStride;

                int Y = yBuf.get(yIndex) & 0xFF;
                int U = uBuf.get(uvIndex) & 0xFF;
                int V = vBuf.get(uvIndex) & 0xFF;

                float yf = Y;
                float uf = U - 128f;
                float vf = V - 128f;

                float rf = yf + 1.402f * vf;
                float gf = yf - 0.344136f * uf - 0.714136f * vf;
                float bf = yf + 1.772f * uf;

                rf = clamp(rf, 0f, 255f);
                gf = clamp(gf, 0f, 255f);
                bf = clamp(bf, 0f, 255f);

                int outX = dx + padX;
                int outY = dy + padY;
                int outIdx = outY * MODEL_W + outX;

                dst.put(rBase + outIdx, rf / 255f);
                dst.put(gBase + outIdx, gf / 255f);
                dst.put(bBase + outIdx, bf / 255f);
            }
        }
    }

    private float clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    // ============================================================
    // ===================== POSTPROCESS ==========================
    // ============================================================

    private List<Map<String, Object>> parseYoloOutputForLastFrame(float[] out) {
        // Assume output is [B, N, (5 + C)] flattened
        // We take the LAST batch item
        int B = batchSize;
        int stride = inferStride(out.length, B); // elements per batch
        int lastBase = (B - 1) * stride;

        int elemPerDet = inferElemPerDet(stride);
        int numDet = stride / elemPerDet;
        int numClasses = elemPerDet - 5;

        List<Box> boxes = new ArrayList<>();

        for (int i = 0; i < numDet; i++) {
            int off = lastBase + i * elemPerDet;

            float cx = out[off];
            float cy = out[off + 1];
            float w = out[off + 2];
            float h = out[off + 3];
            float obj = out[off + 4];

            // Find best class
            int bestClass = -1;
            float bestScore = 0f;
            for (int c = 0; c < numClasses; c++) {
                float sc = out[off + 5 + c];
                if (sc > bestScore) {
                    bestScore = sc;
                    bestClass = c;
                }
            }

            float score = obj * bestScore;
            if (score < confThreshold) continue;

            // Convert to xyxy
            float x1 = cx - w / 2f;
            float y1 = cy - h / 2f;
            float x2 = cx + w / 2f;
            float y2 = cy + h / 2f;

            boxes.add(new Box(x1, y1, x2, y2, score, bestClass));
        }

        // NMS
        List<Box> nmsBoxes = nms(boxes, nmsThreshold);

        // Convert to JS-friendly maps
        List<Map<String, Object>> results = new ArrayList<>();
        for (Box b : nmsBoxes) {
            Map<String, Object> m = new HashMap<>();
            m.put("x", b.x1);
            m.put("y", b.y1);
            m.put("w", b.x2 - b.x1);
            m.put("h", b.y2 - b.y1);
            m.put("score", b.score);
            m.put("class", b.cls);
            results.add(m);
        }

        return results;
    }

    // Try to infer stride per batch item
    private int inferStride(int totalLen, int B) {
        return totalLen / B;
    }

    // Try to infer elements per detection (usually 85 for COCO)
    private int inferElemPerDet(int stride) {
        // Common YOLO: N * 85. Try 85 first.
        if (stride % 85 == 0) return 85;
        if (stride % 84 == 0) return 84;
        if (stride % 6 == 0) return 6; // e.g., custom models
        // Fallback: assume 85
        return 85;
    }

    // ============================================================
    // ===================== NMS ==========================
    // ============================================================

    private static class Box {
        float x1, y1, x2, y2, score;
        int cls;

        Box(float x1, float y1, float x2, float y2, float score, int cls) {
            this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
            this.score = score; this.cls = cls;
        }
    }

    private List<Box> nms(List<Box> boxes, float iouThresh) {
        boxes.sort((a, b) -> Float.compare(b.score, a.score));
        List<Box> keep = new ArrayList<>();

        boolean[] removed = new boolean[boxes.size()];

        for (int i = 0; i < boxes.size(); i++) {
            if (removed[i]) continue;
            Box a = boxes.get(i);
            keep.add(a);

            for (int j = i + 1; j < boxes.size(); j++) {
                if (removed[j]) continue;
                Box b = boxes.get(j);
                if (iou(a, b) > iouThresh) {
                    removed[j] = true;
                }
            }
        }
        return keep;
    }

    private float iou(Box a, Box b) {
        float interX1 = Math.max(a.x1, b.x1);
        float interY1 = Math.max(a.y1, b.y1);
        float interX2 = Math.min(a.x2, b.x2);
        float interY2 = Math.min(a.y2, b.y2);

        float interW = Math.max(0, interX2 - interX1);
        float interH = Math.max(0, interY2 - interY1);
        float interArea = interW * interH;

        float areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
        float areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
 
        return interArea / (areaA + areaB - interArea + 1e-6f);
    }
}
