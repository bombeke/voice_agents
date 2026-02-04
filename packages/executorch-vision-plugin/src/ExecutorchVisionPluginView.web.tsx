import * as React from 'react';

import { ExecutorchVisionPluginViewProps } from './ExecutorchVisionPlugin.types';

export default function ExecutorchVisionPluginView(props: ExecutorchVisionPluginViewProps) {
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
