import { Detection } from "@/hooks/useTagDetection";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  detections: Detection[];
}

export const DetectionOverlay = memo(({ detections }: Props) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {detections.map((d) => (
        <View
          key={d.id}
          style={[
            styles.box,
            {
              left: d.box.x,
              top: d.box.y,
              width: d.box.width,
              height: d.box.height,
            },
          ]}
        >
          <Text style={styles.label}>
            {d.label} ({Math.round(d.confidence * 100)}%)
          </Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00FF00",
  },
  label: {
    backgroundColor: "#00FF00",
    color: "#000",
    fontWeight: "bold",
    paddingHorizontal: 4,
  },
});
