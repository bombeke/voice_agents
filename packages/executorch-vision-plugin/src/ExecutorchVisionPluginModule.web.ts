import { registerWebModule, NativeModule } from 'expo';

import { ExecutorchVisionPluginModuleEvents } from './ExecutorchVisionPlugin.types';

class ExecutorchVisionPluginModule extends NativeModule<ExecutorchVisionPluginModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExecutorchVisionPluginModule, 'ExecutorchVisionPluginModule');
