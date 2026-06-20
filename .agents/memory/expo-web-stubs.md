---
name: Expo Web Stubs
description: All native-only packages that need Metro resolveRequest stubs to run on Expo web
---

Metro config at `apps/mobile/metro.config.js` uses a `resolveRequest` interceptor to redirect native-only packages to stubs in `apps/mobile/web-stubs/` when `platform === "web"`.

## Stubbed packages (as of June 2026)
- react-native-vision-camera
- react-native-vision-camera-executorch
- react-native-vision-camera-location
- react-native-worklets-core
- react-native-worklets
- vision-camera-resize-plugin
- react-native-reanimated
- react-native-mmkv
- react-native-webrtc
- react-native-webrtc-web-shim
- react-native-incall-manager
- react-native-video
- @lodev09/react-native-exify
- @maplibre/maplibre-react-native
- @react-native-camera-roll/camera-roll
- @react-native-community/netinfo
- @shopify/react-native-skia
- @signalwire/react-native
- expo-secure-store
- react-native-executorch
- react-native-executorch-expo-resource-fetcher

**Why:** These packages have native modules that either crash or throw on web. Metro stubs return no-op exports so the web bundle loads cleanly.

**How to apply:** When a new "X is not a function" or "native module missing" error appears in the browser console, create `web-stubs/<pkg-name>.js` with no-op exports and add it to the `WEB_STUBS` map in `metro.config.js`. Then restart the workflow (Metro picks up config changes only on restart).
