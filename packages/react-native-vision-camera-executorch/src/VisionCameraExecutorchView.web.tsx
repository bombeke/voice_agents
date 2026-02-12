import * as React from 'react';

import { VisionCameraExecutorchViewProps } from './VisionCameraExecutorch.types';

export default function VisionCameraExecutorchView(props: VisionCameraExecutorchViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
