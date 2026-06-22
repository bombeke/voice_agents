---
name: Expo SDK 56 Replit setup fixes
description: Fixes required to run Expo SDK 56 Metro server reliably on Replit
---

# Expo SDK 56 Replit Setup Fixes

## Rules

1. **Use static app.json, not app.config.ts**: Expo skill requires static config. Dynamic config (app.config.ts/js) causes "Could not determine Expo version" in the canvas iframe.

2. **BROWSER=none prevents xdg-open crash**: When running `expo start --web` on Replit (headless), add `BROWSER=none` to the env or Metro crashes trying to open a browser. `--no-open` flag is NOT supported in SDK 56.

3. **nspr + nss system packages required**: React Native DevTools binary (@react-native/debugger-shell) requires `libnspr4.so` (nspr) and `libnss3.so` (nss). Install both via `installSystemDependencies`. Without them, DevTools crashes (non-fatal for Metro but noisy).

4. **REACT_NATIVE_DISABLE_DEVTOOLS=1**: Add to all expo start commands / dev scripts to suppress DevTools install attempt. Does not fully prevent the binary check but reduces noise.

5. **metro.config.js blockList**: Use a regex blockList to exclude `.local/` and `.tmp-*` dirs from Metro file watching (prevents ENOENT crashes on Replit skill temp dirs). Use a single RegExp, not an array.

6. **artifacts/mobile: expo health check**: This artifact-managed workflow shows "FAILED" because Replit's health check expects port 18115, but Metro runs on --localhost. Metro IS running (QR code + $REPLIT_EXPO_DEV_DOMAIN URL shown). Non-fixable — the Expo Go URL works regardless.

**Why:** Replit's Expo artifact system routes via $REPLIT_EXPO_DEV_DOMAIN proxy, which is separate from the regular localhost:PORT webview used by the Start application workflow.

**How to apply:** When setting up or restoring Expo SDK 56 in this project, apply all 6 fixes above.
