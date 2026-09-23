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
