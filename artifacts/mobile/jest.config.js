/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  // pnpm nests packages under node_modules/.pnpm/<name>@<ver>/node_modules/,
  // so the optional `.pnpm/.../node_modules/` segment must be allowed through.
  transformIgnorePatterns: [
    "node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|uniwind|lucide-react-native))",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.css$": "<rootDir>/__mocks__/styleMock.js",
  },
};
