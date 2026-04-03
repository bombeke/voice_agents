import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  onCapture: () => void;
  disabled: boolean;
}

export const CameraControls = memo(({ onCapture, disabled }: Props) => {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, disabled && styles.disabled]}
        onPress={onCapture}
        disabled={disabled}
      >
        <Text style={styles.text}>CAPTURE</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
    zIndex: 10,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
