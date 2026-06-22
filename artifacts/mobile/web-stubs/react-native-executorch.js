export const RnExecutorchErrorCode = {
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  ModuleNotLoaded: 'ModuleNotLoaded',
  ModelGenerating: 'ModelGenerating',
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
    this.bbox = { x1: 0, y1: 0, x2: 0, y2: 0 };
  }
}

export const Bbox = { x1: 0, y1: 0, x2: 0, y2: 0 };

export const ObjectDetectionModule = {
  fromCustomModel: async () => ({
    forward: async () => [],
    runOnFrame: null,
    delete: () => {},
    getAvailableInputSizes: () => [],
  }),
};

export const ObjectDetectionModelSources = {};
export const ObjectDetectionOptions = {};
export const ObjectDetectionType = {};
export const PixelData = {};

export function initExecutorch(options) {
  return Promise.resolve();
}

export function useObjectDetection() {
  return {
    forward: async () => [],
    runOnFrame: null,
    error: null,
    isReady: false,
    isGenerating: false,
    downloadProgress: 0,
    getAvailableInputSizes: () => [],
  };
}

export function useClassification() {
  return {
    forward: async () => [],
    error: null,
    isReady: false,
    isGenerating: false,
    downloadProgress: 0,
  };
}

export default {
  initExecutorch,
  RnExecutorchError,
  RnExecutorchErrorCode,
  ResourceSource,
  ObjectDetectionConfig,
  Detection,
  ObjectDetectionModule,
};
