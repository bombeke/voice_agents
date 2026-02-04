import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExecutorchVisionPluginViewProps } from './ExecutorchVisionPlugin.types';

const NativeView: React.ComponentType<ExecutorchVisionPluginViewProps> =
  requireNativeView('ExecutorchVisionPlugin');

export default function ExecutorchVisionPluginView(props: ExecutorchVisionPluginViewProps) {
  return <NativeView {...props} />;
}
