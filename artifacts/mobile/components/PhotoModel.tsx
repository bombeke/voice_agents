import { Image, Modal, Text, TouchableOpacity, View } from "react-native";

export function PhotoModal({ visible, onClose, feature }: any) {
  if (!feature) return null;
  const { properties } = feature;
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/60 justify-center items-center">
        <View className="w-[90%] bg-surface rounded-2xl p-4">
          <Image
            source={{ uri: properties.uri }}
            className="w-full h-[300px] rounded-xl bg-surface-muted"
            resizeMode="contain"
          />
          <View className="mt-2 gap-0.5">
            <Text className="type-title text-text">
              {properties.id || "Photo"}
            </Text>
            <Text className="type-body-small text-text">
              Created: {properties.created || properties.createdAt || ""}
            </Text>
            <Text className="type-body-small text-text">
              Source: {properties.source || "photo"}
            </Text>
            <Text className="type-mono text-text">
              Coordinates: {feature.geometry.coordinates[1]},{" "}
              {feature.geometry.coordinates[0]}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-3 h-[52px] bg-primary rounded-button items-center justify-center"
          >
            <Text className="type-body-strong text-on-primary">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
