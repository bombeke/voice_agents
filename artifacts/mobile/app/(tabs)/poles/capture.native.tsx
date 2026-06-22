import { CameraView } from "@/components/camera/CameraView";
import { Detection } from "@/hooks/useTagDetection";
import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export interface InferResult {
  detections: Detection[];
  frameWidth: number;
  frameHeight: number;
}

export default function CameraScreen() {
  const [form, setForm] = useState({
    selectedTag: "",
    comment: "",
  });
  return (
    <View style={styles.container}>
      <View
        style={styles.formContainer}
        className="px-4 pt-6 pb-4 space-y-4 z-10"
      >
        <View>
          <Text className="text-lg font-semibold text-foreground mb-2">
            Choose Tag
          </Text>

          <View className="bg-white rounded-xl overflow-hidden">
            <Picker selectedValue={form?.selectedTag}
              onValueChange={(value) => {
                setForm?.({
                  ...form,
                  selectedTag: value,
                });
              }}>
              <Picker.Item label="Select a tag..." value="" />
              <Picker.Item label="Damaged Pole" value="damaged" />
              <Picker.Item label="Leaning Pole" value="leaning" />
              <Picker.Item label="Broken Line" value="broken_line" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>
        </View>

        <View>
          <Text className="text-lg font-semibold text-foreground mb-2">
            Comment
          </Text>

          <TextInput
            value={form?.selectedTag}
            onChangeText={(value) => {
              setForm?.({
                ...form,
                comment: value,
              });
            }}
            placeholder="Add additional notes..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-white rounded-xl px-4 py-3 min-h-[100px]"
          />
        </View>
      </View>
      <CameraView 
        form={form}
        onChange={setForm}
      />      
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  label: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    color: 'white',
    fontSize: 16,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
  },
  error: {
    color: "red",
    marginTop: 8,
    fontWeight: "500",
  },
});
