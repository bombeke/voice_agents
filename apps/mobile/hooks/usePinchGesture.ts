import { Gesture } from 'react-native-gesture-handler';
import { Extrapolate, interpolate } from 'react-native-reanimated';

// Constants for zooming behavior
const SCALE_FULL_ZOOM = 3;

export const usePinchGesture = (zoom: any, minZoom: number, maxZoom: number) => {
  return Gesture.Pinch()
    .onBegin(() => {
      zoom.startZoom = zoom.value;
    })
    .onUpdate((event) => {
      if (zoom.startZoom === undefined) return;
      const scale = interpolate(
        event.scale,
        [1 - 1 / SCALE_FULL_ZOOM, 1, SCALE_FULL_ZOOM],
        [-1, 0, 1],
        Extrapolate.CLAMP
      );

      zoom.value = interpolate(
        scale,
        [-1, 0, 1],
        [minZoom, zoom.startZoom, maxZoom],
        Extrapolate.CLAMP
      );
    })
    .onEnd(() => {
      zoom.startZoom = undefined;
    });
};
