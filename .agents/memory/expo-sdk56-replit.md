---
name: Expo SDK 56 Replit setup fixes
description: Fixes required to run Expo SDK 56 Metro server reliably on Replit (web preview + Expo Go + DevTools)
---

# Expo SDK 56 Replit Setup Fixes

## Rules

1. **Use static app.json, not app.config.ts**: Expo skill requires static config. Dynamic config (app.config.ts/js) causes "Could not determine Expo version" in the canvas iframe.

2. **SPA mode for web output**: Set `"web": {"output": "single"}` in app.json. The default "static" mode enables SSR which crashes when any route module imports native-only packages (even stubbed ones). SPA mode skips SSR entirely — correct for mobile-first apps.

3. **BROWSER=none prevents xdg-open crash**: When running `expo start --web` on Replit (headless), add `BROWSER=none` to the env or Metro crashes trying to open a browser. `--no-open` flag is NOT supported in SDK 56.

4. **Chromium/Electron full library set (32 packages)**: The `@react-native/debugger-shell` DevTools binary is a full Electron/Chromium app downloaded via dotslash (~115 MB). Must install ALL these Nix packages or it fails at startup with "error while loading shared libraries":
   - **Batch 1** (installed earlier): `nspr`, `nss`, `dbus`
   - **Batch 2**: `atk`, `at-spi2-atk`, `at-spi2-core`, `cairo`, `pango`, `harfbuzz`, `gdk-pixbuf`, `gtk3`, `mesa`, `libdrm`, `libxkbcommon`, `cups`, `alsa-lib`, `xorg.libX11`, `xorg.libXcomposite`, `xorg.libXcursor`, `xorg.libXdamage`, `xorg.libXext`, `xorg.libXfixes`, `xorg.libXi`, `xorg.libXrandr`, `xorg.libXrender`, `xorg.libXtst`, `xorg.libxcb`, `xorg.libXScrnSaver`, `xorg.libXau`, `xvfb-run`
   - **Batch 3**: `libgbm`, `libglvnd`, `libva`, `libvdpau`, `libudev0-shim`
   - IMPORTANT: `mesa` alone does NOT provide `libgbm.so.1` — must install `libgbm` explicitly too
   - IMPORTANT: `libglvnd` provides `libEGL.so.1` and `libGL.so.1` (vendor-neutral dispatch)

5. **REACT_NATIVE_DISABLE_DEVTOOLS=1**: Add to all expo start commands. Even with all libs installed, DevTools needs a display (DISPLAY env var or Xvfb). Without DISPLAY, the binary loads but window creation fails. `xvfb-run` is installed so you can wrap with it if DevTools window is needed.

6. **Metro binding**: Do NOT use `--host localhost` for `artifacts/mobile: expo` — Metro must bind to 0.0.0.0 for the Expo proxy to reach it. Use `--host localhost` ONLY for the internal `expo start --web --port 4999` inside the Android simulator setup.

7. **Android Simulator server** (`server/android-sim.js`): Runs on port 5000 (public), reverse-proxies to Expo web at port 4999 (localhost). Serves CSS Android phone frame at GET `/`, everything else proxied to Expo. Node must be called with absolute path: `/nix/store/s7awkfc4pym4zj139fsxrjs5xwf5hhnd-nodejs-24.13.0-wrapped/bin/node`.

8. **metro.config.js blockList**: Use a regex blockList to exclude `.local/` and `.tmp-*` dirs from Metro file watching (prevents ENOENT crashes on Replit skill temp dirs).

9. **Platform-split camera/native screens**: Screens importing Camera, Reanimated, Executorch etc. must use `.native.tsx` (full implementation) + `.tsx` (web placeholder). Even with stubs, `class extends undefined` SSR crashes happen at route-validation time.

10. **Web stub completeness**: Stubs must export all named exports the app imports. Key stubs:
    - `react-native-worklets`: export `scheduleOnRN`, `Worklets`
    - `react-native-worklets-core`: export `useSharedValue`, `Worklets`
    - `react-native-executorch`: export `ObjectDetectionModule`, `Bbox`, `RnExecutorchErrorCode.ModuleNotLoaded/ModelGenerating`, `PixelData`

11. **artifacts/mobile: expo health check**: This workflow always shows "FAILED" because Replit's health check expects port 18115 (internal Expo proxy) and Metro takes longer than the 120-second window to fully start. Metro IS running (QR code + Expo Go URL shown). Non-fixable without reducing Metro startup time.

12. **Node.js nix path**: `/nix/store/s7awkfc4pym4zj139fsxrjs5xwf5hhnd-nodejs-24.13.0-wrapped/bin/node` (as of 2026-06-22). This path changes on container resets — always verify with `which node` before hardcoding.

**Why:** Replit's Expo artifact system routes via $REPLIT_EXPO_DEV_DOMAIN proxy (for Expo Go/canvas preview), separate from the regular localhost:PORT webview (for browser preview at port 5000). The DevTools binary is a full Electron app that needs the entire Chromium runtime library stack.

**How to apply:** When setting up or restoring Expo SDK 56 in this project, apply all 12 fixes above.
