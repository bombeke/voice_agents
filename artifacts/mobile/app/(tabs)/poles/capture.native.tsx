import { CameraView } from "@/components/camera/CameraView";
import { Detection } from "@/hooks/useTagDetection";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

export interface InferResult {
  detections: Detection[];
  frameWidth: number;
  frameHeight: number;
}

/**
 * Full-bleed capture screen: the preview owns the whole screen so the surveyor
 * can frame the pole, and the tagging form is raised by CameraView as a sheet
 * once the shot has been taken.
 */
export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
