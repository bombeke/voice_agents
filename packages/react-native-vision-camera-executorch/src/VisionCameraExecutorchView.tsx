import { requireNativeView } from 'expo';
import * as React from 'react';

import { VisionCameraExecutorchViewProps } from './VisionCameraExecutorch.types';

const NativeView: React.ComponentType<VisionCameraExecutorchViewProps> =
  requireNativeView('VisionCameraExecutorch');

export default function VisionCameraExecutorchView(props: VisionCameraExecutorchViewProps) {
  return <NativeView {...props} />;
}
