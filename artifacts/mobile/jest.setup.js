/* global jest */
// Haptics is a native module; tests only need the calls to be no-ops.
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// MMKV loads NitroModules at import time; tests get an in-memory store per id.
jest.mock("react-native-mmkv", () => {
  const stores = new Map();
  return {
    createMMKV: ({ id = "mmkv.default" } = {}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const data = stores.get(id);
      return {
        id,
        set: (key, value) => data.set(key, value),
        getString: (key) => {
          const value = data.get(key);
          return typeof value === "string" ? value : undefined;
        },
        getNumber: (key) => {
          const value = data.get(key);
          return typeof value === "number" ? value : undefined;
        },
        getBoolean: (key) => {
          const value = data.get(key);
          return typeof value === "boolean" ? value : undefined;
        },
        contains: (key) => data.has(key),
        remove: (key) => data.delete(key),
        getAllKeys: () => [...data.keys()],
        clearAll: () => data.clear(),
      };
    },
  };
});

// Worklets and Reanimated ship their own JS-thread mocks.
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

// On-device inference is native; tests get the registry shape and a detector
// that never loads. Tests that need detections override useObjectDetector.
jest.mock("react-native-executorch", () => ({
  models: {
    objectDetection: {
      YOLO26: {
        NANO: {
          SIZE_384: {
            DEFAULT: {
              modelPath: "https://example.test/yolo26n_384_xnnpack_fp32.pte",
              modelOpts: {
                labels: [
                  "person",
                  "car",
                  "traffic light",
                  "fire hydrant",
                  "pole",
                ],
                boxFormat: "xyxy",
                resizeMode: "letterbox",
                interpolation: "linear",
                normalizeOpts: { alpha: 1 / 255, beta: 0 },
                defaultConfidenceThreshold: 0.25,
                defaultIouThreshold: 0.7,
              },
            },
          },
        },
      },
    },
  },
  download: jest.fn(async (source) => source),
  useObjectDetector: jest.fn(() => ({
    isReady: false,
    error: undefined,
    downloadProgress: 0,
    detectObjectsWorklet: undefined,
  })),
}));

// Speech recognition is native; tests swap the recogniser with setSpeechToText.
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => false),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));

// ViroReact (ARCore / ARKit) is native. By default the device has no AR, so
// the capture screen uses VisionCamera; AR tests override isARSupportedOnDevice.
jest.mock("@reactvision/react-viro", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    isARSupportedOnDevice: jest.fn(async () => ({ isARSupported: false })),
    ViroARSceneNavigator: (props) =>
      createElement(View, { testID: "ar-view", ...props }),
    ViroARScene: ({ children }) => children ?? null,
    ViroPolyline: () => null,
    ViroMaterials: { createMaterials: jest.fn() },
  };
});

// EXIF is read natively; tests get no tags.
jest.mock("@lodev09/react-native-exify", () => ({
  read: jest.fn(async () => null),
  write: jest.fn(async () => ({})),
}));

// expo-crypto is native; tests get Node's crypto. Tests that need
// predictable ids override it with their own jest.mock.
jest.mock("expo-crypto", () => {
  const crypto = jest.requireActual("node:crypto");
  return {
    randomUUID: () => crypto.randomUUID(),
    getRandomBytes: (n) => new Uint8Array(crypto.randomBytes(n)),
    digestStringAsync: async (_algo, data) =>
      crypto.createHash("sha256").update(data).digest("hex"),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  };
});

// The on-device database is native. Tests use db/testing (node:sqlite) via
// setDatabase / setDatabaseFactory; opening op-sqlite here is a bug.
jest.mock("@op-engineering/op-sqlite", () => ({
  open: () => {
    throw new Error("op-sqlite is native: use db/testing in tests");
  },
}));
