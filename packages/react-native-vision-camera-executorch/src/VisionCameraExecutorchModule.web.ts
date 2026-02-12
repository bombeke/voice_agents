import { registerWebModule, NativeModule } from 'expo';

import { VisionCameraExecutorchModuleEvents } from './VisionCameraExecutorch.types';

class VisionCameraExecutorchModule extends NativeModule<VisionCameraExecutorchModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(VisionCameraExecutorchModule, 'VisionCameraExecutorchModule');
