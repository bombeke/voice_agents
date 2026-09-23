// Web stand-in for react-native-executorch 0.10: on-device inference is
// native-only, so the web build downloads nothing and detects nothing.
export class RnExecuTorchError extends Error {}

const YOLO26_OPTS = {
  labels: [],
  boxFormat: "xyxy",
  resizeMode: "letterbox",
  interpolation: "linear",
  normalizeOpts: { alpha: 1 / 255, beta: 0 },
  defaultConfidenceThreshold: 0.25,
  defaultIouThreshold: 0.7,
};

export const models = {
  objectDetection: {
    YOLO26: {
      NANO: {
        SIZE_384: {
          DEFAULT: {
            modelPath: "web-stub/yolo26n_384.pte",
            modelOpts: YOLO26_OPTS,
          },
        },
      },
    },
  },
};

export async function download(source) {
  return source;
}

export function useObjectDetector(config) {
  return {
    isReady: false,
    error: new RnExecuTorchError("Object detection is not available on web."),
    downloadProgress: 0,
    resource: undefined,
    labels: config?.modelOpts?.labels ?? [],
    detectObjects: undefined,
    detectObjectsWorklet: undefined,
  };
}
