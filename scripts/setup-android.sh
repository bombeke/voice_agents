#!/usr/bin/env bash
set -e

export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac))))

export ANDROID_HOME=/home/runner/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME

export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

export GRADLE_OPTS="-Xmx6g -XX:MaxMetaspaceSize=512m"

mkdir -p $ANDROID_HOME

SDKMANAGER=$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager

if [ ! -f "$SDKMANAGER" ]; then
  echo "Installing Android command line tools..."

  mkdir -p $ANDROID_HOME/cmdline-tools

  curl -L \
    https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    -o /tmp/cmdline-tools.zip

  unzip -q /tmp/cmdline-tools.zip -d /tmp

  mkdir -p $ANDROID_HOME/cmdline-tools/latest

  mv /tmp/cmdline-tools/* \
     $ANDROID_HOME/cmdline-tools/latest/

  rm -rf /tmp/cmdline-tools*
fi

yes | $SDKMANAGER --licenses >/dev/null

$SDKMANAGER --update

$SDKMANAGER --install \
  "platform-tools" \
  "build-tools;36.0.0" \
  "platforms;android-36"

if ! avdmanager list avd | grep -q Pixel_7; then
  echo "no" | avdmanager create avd \
    -n Pixel_7 \
    -k "system-images;android-36;google_apis;x86_64"
fi

echo "Android SDK ready"
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"