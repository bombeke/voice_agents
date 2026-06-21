# Bombeke PoleVision AI Toolkit

AI Agents for Disease Surveillance, Pole Defects, Sanitation, Roads & Traffic Analytics.

Built with Expo / React Native in a pnpm monorepo (`voice-agents-workspace`).

---

## Running the App

### Web preview (browser)
The **Start application** workflow runs the Expo web build on port 5000. This is visible in Replit's preview pane.

### Expo Go (physical device)
Start the **Mobile (Expo Go)** workflow from the Replit workflow panel.
- It starts Metro on port 8080 with your Replit public hostname
- Install **Expo Go** on your Android or iOS device
- Scan the QR code shown in the console

### Build a real APK (EAS Build — recommended for full native features)
Run the **EAS Build (Android APK)** workflow, or from the shell:
```bash
source scripts/setup-android.sh
cd apps/mobile
npx eas login          # first time only
npx eas build --platform android --profile development
```
This uses Expo's cloud build service and produces a downloadable `.apk`.

---

## Android SDK Environment

All tools are installed via Nix and available in the shell:

| Tool | Version | Path |
|------|---------|------|
| JDK | OpenJDK 17.0.15 | via Nix (`jdk17`) |
| ADB | 37.0.0 | `/home/runner/android-sdk/platform-tools/adb` |
| Gradle | 8.14.2 | via Nix (`gradle`) |
| Android Build-Tools | 35.0.0 | `/home/runner/android-sdk/build-tools/35.0.0` |
| Android Platform | API 35 | `/home/runner/android-sdk/platforms/android-35` |
| sdkmanager | 11.0 | `/home/runner/android-sdk/cmdline-tools/latest/bin/sdkmanager` |

Key environment variables (set in workflow commands):
```
JAVA_HOME=/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/lib/openjdk
ANDROID_HOME=/home/runner/android-sdk
ANDROID_SDK_ROOT=/home/runner/android-sdk
```

If the Android SDK is missing after a container reset, restore it:
```bash
bash scripts/setup-android.sh
```

### Why no Android emulator?
The Android emulator requires `/dev/kvm` (hardware virtualization). Replit containers do not expose `/dev/kvm` even though the host CPU supports VT-x. Use a physical device with Expo Go or EAS cloud builds instead.

### Why no iOS simulator?
iOS simulator requires macOS. Replit runs on Linux. Use a physical iOS device with Expo Go or EAS cloud builds instead.

---

## Project Structure

```
voice-agents-workspace/
├── apps/mobile/           # Expo React Native app
│   ├── app/               # Expo Router screens
│   │   ├── (auth)/        # Login screen
│   │   ├── (tabs)/        # Main app tabs
│   │   └── _layout.tsx    # Root layout
│   ├── services/          # Business logic
│   │   ├── storage/       # LegendState, MMKV, Storage
│   │   └── PrepareModel.ts
│   ├── web-stubs/         # No-op stubs for native-only packages on web
│   ├── metro.config.js    # Web stub redirects via resolveRequest
│   ├── app.config.ts      # Expo config (bundle IDs, permissions, plugins)
│   └── eas.json           # EAS Build profiles
└── scripts/
    └── setup-android.sh   # Android SDK restore script
```

## EAS Project
- Project ID: `d1ba06a7-8e54-4cc7-abe2-6be9c680f040`
- Android package: `org.bombeke.voiceagents`
- iOS bundle: `org.bombeke.voiceagents`

---

## User Preferences
- Use full nix path for node in workflows: `/nix/store/bl6iwirn83qj9r8wng43kfdqd5mfahj8-nodejs-22.22.0/bin/node`
- Web stubs pattern: add native-only packages to `metro.config.js` WEB_STUBS map + create stub in `web-stubs/`
- Always add `Platform.OS !== 'web'` guard before calling native-only APIs
