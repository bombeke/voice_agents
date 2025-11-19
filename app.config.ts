import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    "name": "voice-agents",
    "slug": "voice-agents",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/images/icon.png",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "scheme": "voiceagents",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bitcode": false,
      "bundleIdentifier": "org.bombeke.voiceagents",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "permissions": [
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.WAKE_LOCK",
        "android.permission.BLUETOOTH"
      ],
      "package": "org.bombeke.voiceagents"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-asset",
      "@config-plugins/react-native-webrtc",
      "expo-web-browser",
      "expo-font",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
          "recordAudioAndroid": true
        }
      ],
      [
        "react-native-vision-camera",
        {
          "cameraPermissionText": "$(PRODUCT_NAME) needs access to your Camera.",

          // optionally, if you want to record audio:
          "enableMicrophonePermission": true,
          "microphonePermissionText": "$(PRODUCT_NAME) needs access to your Microphone."
        }
      ],
      [
        "react-native-fast-tflite",
        {
          "enableCoreMLDelegate": true,
          "enableAndroidGpuLibraries": ["libOpenCL-pixel.so", "libGLES_mali.so"]
        }
      ],
      "react-native-maps",
      "@maplibre/maplibre-react-native"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "d1ba06a7-8e54-4cc7-abe2-6be9c680f040"
      },
      "URL": process.env.URL,
      "PROJECT_ID": process.env.PROJECT_ID,
      "API_TOKEN": process.env.API_TOKEN,
    }
  });
