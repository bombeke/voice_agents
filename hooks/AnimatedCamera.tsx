import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Camera } from 'react-native-vision-camera';

// Create the animated component
const AnimatedCamera = Animated.createAnimatedComponent(Camera);

// Animated props for the Camera (example for animated `zoom`)
const useAnimatedCameraProps = (zoomValue: SharedValue<number>) =>
  useAnimatedProps(() => ({
    zoom: zoomValue.value,
  }));

export { AnimatedCamera, useAnimatedCameraProps };
