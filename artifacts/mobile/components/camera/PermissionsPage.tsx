import { CameraIcon } from "lucide-react-native";
import { Text } from "react-native";
import { Button, View, YStack } from "tamagui";

interface IPermissionsPage {
  allowCameraLocationPermissions: () => Promise<void>;
}
export const PermissionsPage = ({
  allowCameraLocationPermissions,
}: IPermissionsPage) => {
  return (
    <YStack justify="center" verticalAlign="center" flex={1} gap="$4">
      <View className="flex-1 items-center justify-center p-8 bg-background">
        <CameraIcon size={64} className="text-muted-foreground" />
        <Text className="mt-6 text-2xl font-bold text-foreground text-center">
          Camera & Location Access
        </Text>
        <Text className="mt-3 text-base text-muted-foreground text-center leading-6">
          We need camera and location permissions to detect and record utility
          poles.
        </Text>
        <Button
          className="mt-8 bg-primary px-8 py-5 rounded-xl"
          onPress={allowCameraLocationPermissions}
        >
          <Text className="text-white text-base font-semibold">
            Grant Permissions
          </Text>
        </Button>
      </View>
    </YStack>
  );
};
