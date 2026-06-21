---
name: Android SDK Setup
description: How Android SDK is installed and configured in this Replit environment
---

## What's installed (via Nix + manual SDK download)
- JDK 17: via `pkgs.jdk17` in `replit.nix` (available as `java` in shell)
- ADB / android-tools: via `pkgs.android-tools` in `replit.nix`
- Gradle 8.14.2: via `pkgs.gradle` in `replit.nix`
- Android SDK: downloaded manually to `/home/runner/android-sdk/`
  - cmdline-tools 11 (sdkmanager, avdmanager)
  - platform-tools 37.0.0 (adb, fastboot)
  - build-tools 35.0.0
  - platforms;android-35

## Key paths
- JAVA_HOME: `/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/lib/openjdk`
- ANDROID_HOME: `/home/runner/android-sdk`
- Setup restore script: `scripts/setup-android.sh`

## Environment variable setup
Cannot edit `.replit` or `replit.nix` directly. Environment variables are set inline in workflow commands. Use this pattern:
```
JAVA_HOME=<path> ANDROID_HOME=/home/runner/android-sdk ... <command>
```

## Emulator limitations
- `/dev/kvm` is NOT available in Replit containers (despite CPU having VT-x)
- Android emulator cannot run — use EAS Build or physical device with Expo Go
- iOS simulator requires macOS — not possible in Replit (Linux)

## Restore after container reset
`/home/runner/android-sdk` persists across sessions (it's in the user's home dir).
If missing, run: `bash scripts/setup-android.sh`

**Why:** Android SDK was downloaded manually because `androidenv` in Nix is complex to configure and the manual approach gives more control over which SDK components are installed.
