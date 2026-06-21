#!/usr/bin/env bash
# Android SDK setup script
# Run this to install/restore Android SDK components after a container reset

export JAVA_HOME=/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/lib/openjdk
export ANDROID_HOME=/home/runner/android-sdk
export ANDROID_SDK_ROOT=/home/runner/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
export GRADLE_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"

SDKMANAGER=$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager

# Download and install SDK command-line tools if missing
if [ ! -f "$SDKMANAGER" ]; then
  echo "Android SDK command-line tools not found. Downloading..."
  mkdir -p $ANDROID_HOME/cmdline-tools
  curl -sL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o /tmp/cmdline-tools.zip
  unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-tmp
  mkdir -p $ANDROID_HOME/cmdline-tools/latest
  mv /tmp/cmdline-tools-tmp/cmdline-tools/* $ANDROID_HOME/cmdline-tools/latest/
  rm -rf /tmp/cmdline-tools-tmp /tmp/cmdline-tools.zip
  echo "Command-line tools installed."
fi

# Accept licenses
yes | $SDKMANAGER --licenses > /dev/null 2>&1

# Install required SDK components if missing
COMPONENTS_NEEDED=0
[ ! -d "$ANDROID_HOME/platform-tools" ] && COMPONENTS_NEEDED=1
[ ! -d "$ANDROID_HOME/build-tools/35.0.0" ] && COMPONENTS_NEEDED=1
[ ! -d "$ANDROID_HOME/platforms/android-35" ] && COMPONENTS_NEEDED=1

if [ $COMPONENTS_NEEDED -eq 1 ]; then
  echo "Installing Android SDK components..."
  $SDKMANAGER --install \
    "platform-tools" \
    "build-tools;35.0.0" \
    "platforms;android-35"
  echo "SDK components installed."
else
  echo "Android SDK components already installed."
fi

echo ""
echo "Android SDK ready:"
echo "  JAVA_HOME=$JAVA_HOME"
echo "  ANDROID_HOME=$ANDROID_HOME"
echo "  JDK: $(java -version 2>&1 | head -1)"
echo "  ADB: $($ANDROID_HOME/platform-tools/adb version 2>&1 | head -1)"
echo ""
echo "To use in your shell:"
echo "  source scripts/setup-android.sh"
