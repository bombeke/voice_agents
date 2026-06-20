export const RnExecutorchErrorCode = {
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
};

export class RnExecutorchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || RnExecutorchErrorCode.UNKNOWN;
  }
}

export const ResourceSource = {};

export const ObjectDetectionConfig = {};

export class Detection {
  constructor() {
    this.label = '';
    this.score = 0;
    this.bbox = { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function initExecutorch(options) {
  return Promise.resolve();
}

export function useObjectDetection() {
  return {
    forward: async () => [],
    error: null,
    isReady: false,
    isGenerating: false,
  };
}

export function useClassification() {
  return {
    forward: async () => [],
    error: null,
    isReady: false,
    isGenerating: false,
  };
}

export default {
  initExecutorch,
  RnExecutorchError,
  RnExecutorchErrorCode,
  ResourceSource,
  ObjectDetectionConfig,
  Detection,
};
