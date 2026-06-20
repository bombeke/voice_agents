import React from 'react';
import { View } from 'react-native';

export const Camera = React.forwardRef((props, ref) => React.createElement(View, props));
Camera.getAvailableCameraDevices = () => [];
Camera.getCameraPermissionStatus = () => 'not-determined';
Camera.getMicrophonePermissionStatus = () => 'not-determined';
Camera.requestCameraPermission = async () => 'denied';
Camera.requestMicrophonePermission = async () => 'denied';

export function useCameraDevice() { return undefined; }
export function useCameraDevices() { return []; }
export function useCameraFormat() { return undefined; }
export function useFrameProcessor() { return undefined; }
export function useCameraPermission() { return { hasPermission: false, requestPermission: async () => false }; }
export function useMicrophonePermission() { return { hasPermission: false, requestPermission: async () => false }; }
export function useCodeScanner() { return {}; }
export function createRunInJsFn(fn) { return fn; }
export function createRunInContextFn(fn) { return fn; }
export const VisionCameraProxy = { initFrameProcessorPlugin: () => ({}) };

export default Camera;
