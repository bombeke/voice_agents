import { useCachedTensorModel } from "@/components/ModelContext";
import { useState } from "react";
import { runAtTargetFps, useFrameProcessor } from "react-native-vision-camera";
import { scheduleOnRN } from 'react-native-worklets';
import { useResizePlugin } from "vision-camera-resize-plugin";

export const usePoleDetection=()=>{
    const [cameraResults, setCameraResults] = useState<any[]>([]);
    const { resize } = useResizePlugin();
    const model = useCachedTensorModel();

    const updateCameraResults = (results: any[]) => {
        setCameraResults(results);
    };

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet'
        if (model == null) {
            // model is still loading...
            return
        }
        runAtTargetFps(10, () => {
            'worklet'
            console.log(`${frame.timestamp}: ${frame.width}x${frame.height} ${frame.pixelFormat} Frame (${frame.orientation})`)
            const resized = resize(frame, {
            scale: {
                width: 320,
                height: 320,
            },
            pixelFormat: 'rgb',
            dataType: 'uint8',
            })
            const result = model.runSync([resized])
            const num_detections = result[3]?.[0] ?? 0
            console.log('POLEResult: ' + num_detections)
            scheduleOnRN(updateCameraResults, result);
        })
    }, [model, updateCameraResults])
    return { cameraResults, frameProcessor }
}