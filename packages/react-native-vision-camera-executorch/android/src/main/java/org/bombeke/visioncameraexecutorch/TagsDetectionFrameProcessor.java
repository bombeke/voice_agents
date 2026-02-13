package org.bombeke.visioncameraexecutorch;

import com.mrousavy.camera.frameprocessors.Frame;
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;

import org.pytorch.executorch.EValue;
import org.pytorch.executorch.Module;
import org.pytorch.executorch.Tensor;

import java.nio.ByteBuffer;
import java.util.Map;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class TagsDetectorFrameProcessor extends FrameProcessorPlugin {

    private final Module module;

    // Batch config
    private final int batchSize = 4; // <-- change this (e.g. 2, 4, 8)

    // Reusable buffers
    private float[] batchInputBuffer = null;
    private long[] batchShape = null;
    private Tensor batchInputTensor = null;

    private int framesInBatch = 0;
    private int width = -1;
    private int height = -1;

    public TagsDetectorFrameProcessor(@NotNull VisionCameraProxy proxy, @Nullable Map<String, Object> options) {
        super();

        String modelPath = "/data/local/tmp/model.et";
        if (options != null && options.get("modelPath") instanceof String) {
            modelPath = (String) options.get("modelPath");
        }

        module = Module.load(modelPath);
    }

    @Nullable
    @Override
    public Object callback(@NotNull Frame frame, @Nullable Map<String, Object> arguments) {
        final int w = frame.getWidth();
        final int h = frame.getHeight();

        // Initialize / re-init if size changes
        if (batchInputBuffer == null || w != width || h != height) {
            width = w;
            height = h;

            int pixelsPerFrame = width * height;
            batchInputBuffer = new float[batchSize * pixelsPerFrame];
            batchShape = new long[]{batchSize, 1, height, width};
            batchInputTensor = Tensor.fromBlob(batchInputBuffer, batchShape);
            framesInBatch = 0;
        }

        // Get Y plane
        Frame.Plane yPlane = frame.getPlanes()[0];
        ByteBuffer buffer = yPlane.getBuffer();
        final int rowStride = yPlane.getRowStride();

        // Copy this frame into batch buffer
        int pixelsPerFrame = width * height;
        int baseOffset = framesInBatch * pixelsPerFrame;

        int i = 0;
        for (int y = 0; y < height; y++) {
            int rowStart = y * rowStride;
            for (int x = 0; x < width; x++) {
                int v = buffer.get(rowStart + x) & 0xFF;
                batchInputBuffer[baseOffset + i] = v * (1.0f / 255.0f);
                i++;
            }
        }

        framesInBatch++;

        // If batch not full yet, return null (or last result if you prefer)
        if (framesInBatch < batchSize) {
            return null;
        }

        // Run inference 5 times (warm-up / stability)
        float[] outData = null;
        for (int iter = 0; iter < 5; iter++) {
            EValue[] outputs = module.forward(EValue.from(batchInputTensor));
            Tensor outputTensor = outputs[0].toTensor();
            outData = outputTensor.getDataAsFloatArray();
        }

        // Reset batch
        framesInBatch = 0;

        if (outData == null || outData.length == 0) {
            return null;
        }

        // Example: return result of LAST frame in batch
        // If output is [B, ...], and you want per-frame results,
        // you can slice this array instead.
        int outputsPerFrame = outData.length / batchSize;
        int lastFrameOffset = (batchSize - 1) * outputsPerFrame;

        return outData[lastFrameOffset]; // or return full outData
    }
}
