---
name: Expo SDK 56 Replit setup fixes
description: Fixes required to run Expo SDK 56 Metro server reliably on Replit (web preview + Expo Go)
---

# Expo SDK 56 Replit Setup Fixes

## Rules

1. **Use static app.json, not app.config.ts**: Expo skill requires static config. Dynamic config (app.config.ts/js) causes "Could not determine Expo version" in the canvas iframe.

2. **SPA mode for web output**: Set `"web": {"output": "single"}` in app.json. The default "static" mode enables SSR which crashes when any route module imports native-only packages (even stubbed ones). SPA mode skips SSR entirely — correct for mobile-first apps.

3. **BROWSER=none prevents xdg-open crash**: When running `expo start --web` on Replit (headless), add `BROWSER=none` to the env or Metro crashes trying to open a browser. `--no-open` flag is NOT supported in SDK 56.

4. **nspr + nss + dbus system packages**: React Native DevTools binary requires libnspr4.so (nspr), libnss3.so (nss), libdbus-1.so.3 (dbus), libatk-1.0.so.0 (atk). Install via installSystemDependencies. Without them, DevTools crashes with a chain of missing-lib errors — non-fatal for Metro but noisy.

5. **REACT_NATIVE_DISABLE_DEVTOOLS=1**: Add to all expo start commands / dev scripts. Does not fully prevent the binary check but reduces noise.

6. **metro.config.js blockList**: Use a regex blockList to exclude `.local/` and `.tmp-*` dirs from Metro file watching (prevents ENOENT crashes on Replit skill temp dirs).

7. **Platform-split camera/native screens**: Screens importing Camera, Reanimated, Executorch etc. must use `.native.tsx` (full implementation) + `.tsx` (web placeholder). Even with stubs, `class extends undefined` SSR crashes happen at route-validation time. Pattern: rename original to `.native.tsx`, create simple `.tsx` with a "mobile-only" message.

8. **Web stub completeness**: Stubs must export all named exports the app imports. Key stubs to maintain:
   - `react-native-worklets`: export `scheduleOnRN`, `Worklets`
   - `react-native-worklets-core`: export `useSharedValue`, `Worklets`
   - `react-native-executorch`: export `ObjectDetectionModule`, `Bbox`, `RnExecutorchErrorCode.ModuleNotLoaded/ModelGenerating`, `PixelData`

9. **artifacts/mobile: expo health check**: This artifact-managed workflow shows "FAILED" because Replit's health check expects port 18115, not port 5001. Metro IS running (QR code + $REPLIT_EXPO_DEV_DOMAIN URL shown). Non-fixable via configureWorkflow — Expo Go URL works regardless.

10. **Start application webview**: Use `cd artifacts/mobile && BROWSER=none REACT_NATIVE_DISABLE_DEVTOOLS=1 pnpm exec expo start --web --port 5000`. No `--host localhost` (prevents external proxy access). No `--no-open` (unsupported in SDK 56).

**Why:** Replit's Expo artifact system routes via $REPLIT_EXPO_DEV_DOMAIN proxy (for Expo Go/canvas preview), separate from the regular localhost:PORT webview (for browser preview at port 5000).

**How to apply:** When setting up or restoring Expo SDK 56 in this project, apply all 10 fixes above.
