import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
import { CameraIcon } from "lucide-react-native";
import { Text, View } from "react-native";

interface IPermissionsPage {
  allowCameraLocationPermissions: () => Promise<void>;
}
export const PermissionsPage = ({
  allowCameraLocationPermissions,
}: IPermissionsPage) => {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-background">
      <CameraIcon size={64} color={colors.textMuted} />
      <Text className="mt-6 type-h2 text-text text-center">
        Camera & Location Access
      </Text>
      <Text className="mt-3 type-body text-text-muted text-center">
        We need camera and location permissions to detect and record utility
        poles.
      </Text>
      <Button
        className="mt-8 self-stretch"
        onPress={allowCameraLocationPermissions}
      >
        Grant Permissions
      </Button>
    </View>
  );
};
