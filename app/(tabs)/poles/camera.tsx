import Colors from '@/constants/Colors';
//import { useUtilityPoles } from '@/providers/UtilityStoreProvider';
//import { generateText } from '@rork-ai/toolkit-sdk';
import { useCachedTensorModel } from '@/components/ModelContext';
import { base64ToTensor } from '@/hooks/Helpers';

import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Accuracy, getCurrentPositionAsync, useForegroundPermissions } from 'expo-location';
import { router, Stack } from 'expo-router';
import { Camera, Check, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

const { width: sWidth, height: sHeight } = Dimensions.get('window');

export default function CameraScreen() {
  const [facing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = useForegroundPermissions();
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const model = useCachedTensorModel();
  const frameProcessorResults = useSharedValue<any[]>([]);
  
  //const { addPole, isAddingPole } = useUtilityPoles();
  const cameraRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.setValue(1);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    if (Platform.OS !== 'web') {
      await impactAsync(ImpactFeedbackStyle.Heavy);
    }

    setIsCapturing(true);
    startPulse();

    try {
      const locationResult = await getCurrentPositionAsync({
        accuracy: Accuracy.High,
      });

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 640, height: 640 } }],
        { compress: 1, format: SaveFormat.PNG, base64: true }
      );
      const { tensor, width, height } = base64ToTensor(resized.base64);


      // Convert to float32 RGB
      //const tensor = rgbaToFloatRGB(resized, 640, 640);
        const inputs =  {
          data: tensor,
          width: width,
          height: height,
          pixelFormat: "rgb",
          dataType: "float32"
        }
      console.log("Image4")
      try {

        const outputs = model.run([inputs]);
        if (!outputs || outputs.length < 4) return []

              const boxes = outputs[0]        // Object with string keys (40 elements: 10 detections × 4 coordinates each)
              const classes = outputs[1]      // Object with string keys (class indices)
              const scores = outputs[2]       // Object with string keys (confidence scores)
              const numDetections = outputs[3][0] // Single value: number of valid detections

              const detectedObjects = []
              const count = Math.min(numDetections, 10)

              for (let i = 0; i < count; i++) {
                // All outputs are objects with string keys
                const score = scores[i.toString()]

                if (score < 0.5) continue

                const classIndex = Math.floor(classes[i.toString()])
                const label =  `Class ${classIndex}`

                // Get bounding box coordinates (normalized 0-1)
                const ymin = boxes[(i * 4 + 0).toString()]
                const xmin = boxes[(i * 4 + 1).toString()]
                const ymax = boxes[(i * 4 + 2).toString()]
                const xmax = boxes[(i * 4 + 3).toString()]

                const object = {
                  id: `${i}-${performance.now()}`,
                  label,
                  confidence: score,
                  box: {
                    x: Math.max(0, xmin * sWidth),
                    y: Math.max(0, ymin * sHeight),
                    width: Math.min(sWidth, (xmax - xmin) * sWidth),
                    height: Math.min(sHeight, (ymax - ymin) * sHeight),
                  },
                }

                detectedObjects.push(object)
                console.log("POLE:Detect:",detectedObjects?.length)
              }
      } 
      catch (e) {
          console.warn("TF async failed", e)
      }

      console.log('[Camera] Photo captured:', photo.uri);
      console.log('[Camera] Location:', locationResult.coords);

      const detectionPrompt = `Analyze this image and determine if it contains a utility pole or power pole. 
      Respond with ONLY a JSON object in this format: {"hasPole": true/false, "confidence": 0-100}
      Be strict - only return true if you clearly see a utility pole or power pole structure.`;

      /*const detectionResult = await generateText({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: detectionPrompt },
              { type: 'image', image: `data:image/jpeg;base64,${photo.base64}` },
            ],
          },
        ],
      });
      */
     const detectionResult = { hasPole: true, confidence: 80 };

      console.log('[AI] Detection result:', detectionResult);

      let hasPole = false;
      let confidence = 0;

        const parsed = detectionResult;
        hasPole = parsed.hasPole === true;
        confidence = parsed.confidence || 0;

      if (hasPole) {
        /*await addPole({
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          timestamp: Date.now(),
          imageUri: photo.uri,
          detectionConfidence: confidence,
        });*/

        setLastCapture('Utility pole detected and saved!');
        
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setLastCapture('No utility pole detected. Try again.');
        
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }

      setTimeout(() => setLastCapture(null), 3000);
    } 
    catch (error) {
      console.error('[Camera] Error capturing:', error);
      setLastCapture('Error capturing pole. Please try again.');
      
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      setTimeout(() => setLastCapture(null), 3000);
    } finally {
      setIsCapturing(false);
      stopPulse();
    }
  };

  if (!permission || !locationPermission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!permission.granted || !locationPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Camera size={64} color={Colors.light.textSecondary} />
        <Text style={styles.permissionTitle}>Camera & Location Access</Text>
        <Text style={styles.permissionText}>
          We need camera and location permissions to detect and record utility poles.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            await requestPermission();
            await requestLocationPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Detect Poles',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, isCapturing && styles.statusDotActive]} />
              <Text style={styles.statusText}>
                {isCapturing ? 'Analyzing...' : 'Ready to detect'}
              </Text>
            </View>
          </View>

          <View style={styles.targetFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <Text style={styles.targetText}>Center pole in frame</Text>
          </View>

          {lastCapture && (
            <View
              style={[
                styles.captureNotification,
                lastCapture.includes('detected and saved') && styles.captureNotificationSuccess,
              ]}
            >
              {lastCapture.includes('detected and saved') ? (
                <Check size={20} color="#FFFFFF" />
              ) : (
                <X size={20} color="#FFFFFF" />
              )}
              <Text style={styles.captureNotificationText}>{lastCapture}</Text>
            </View>
          )}

          <View style={styles.bottomBar}>
            <View style={styles.captureButtonContainer}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.captureButton, isCapturing && styles.captureButtonActive]}
                  onPress={handleCapture}
                  disabled={isCapturing} //|| isAddingPole}
                  activeOpacity={0.8}
                >
                  {isCapturing?// || isAddingPole ?
                   (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : (
                    <Camera size={32} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

            <Text style={styles.instructionText}>
              Tap to capture and detect utility pole
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 32,
    backgroundColor: Colors.light.background,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 24,
    textAlign: 'center' as const,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  permissionButton: {
    marginTop: 32,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBar: {
    padding: 16,
    alignItems: 'flex-start' as const,
  },
  statusIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: Colors.light.warning,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  targetFrame: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 40,
  },
  corner: {
    position: 'absolute' as const,
    width: 40,
    height: 40,
    borderColor: Colors.light.primary,
  },
  cornerTopLeft: {
    top: '20%',
    left: '15%',
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: '20%',
    right: '15%',
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: '20%',
    left: '15%',
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: '20%',
    right: '15%',
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  targetText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  captureNotification: {
    position: 'absolute' as const,
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.danger,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureNotificationSuccess: {
    backgroundColor: Colors.light.success,
  },
  captureNotificationText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
    marginLeft: 12,
    flex: 1,
  },
  bottomBar: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  captureButtonContainer: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonActive: {
    backgroundColor: Colors.light.warning,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
});
