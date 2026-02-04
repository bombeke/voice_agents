# executorch-vision-plugin

Executorch Yolo vision frame processor

#Example 1
import { Camera, useFrameProcessor } from 'react-native-vision-camera'
import { YOLO_FRAME_PROCESSOR_NAME } from 'executorch-vision-plugin'

const frameProcessor = useFrameProcessor((frame) => {
  'worklet'
  global[YOLO_FRAME_PROCESSOR_NAME](frame)
}, [])

<Camera frameProcessor={frameProcessor} frameProcessorFps={10} />

#Example 2
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { registerModels, getLatestDetections, YOLO_FRAME_PROCESSOR_NAME } from 'expo-yolo-executorch';

registerModels([
  {
    name: 'yolov26n',
    url: 'https://your.cdn/yolov26n.pte',
    inputWidth: 320,
    inputHeight: 320,
    numClasses: 80,
  },
]);

const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  global[YOLO_FRAME_PROCESSOR_NAME](frame);
}, []);

setInterval(() => {
  const dets = getLatestDetections();
  console.log(dets);
}, 100);

