import { withDangerousMod } from '@expo/config-plugins';
import fs from 'fs';
import path from 'path';

export default function withYolo(config) {
  return withDangerousMod(config, ['android', async (config) => {
    // Copy ExecuTorch libs if needed
    return config;
  }]);
}
