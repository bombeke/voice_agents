import { NativeModule, requireNativeModule } from 'expo';

import { ExecutorchVisionPluginModuleEvents } from './ExecutorchVisionPlugin.types';

declare class ExecutorchVisionPluginModule extends NativeModule<ExecutorchVisionPluginModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExecutorchVisionPluginModule>('ExecutorchVisionPlugin');
