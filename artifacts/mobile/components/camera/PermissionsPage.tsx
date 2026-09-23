import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Text, View } from "react-native";

interface PermissionsPageProps {
  onAllow: () => void;
}

/** Shown until camera permission is granted; location is asked for with it. */
export function PermissionsPage({ onAllow }: PermissionsPageProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8 bg-background">
      <Icon name="capture" size={56} color={colors.textMuted} />
      <Text
        accessibilityRole="header"
        className="mt-3 type-h2 text-text text-center"
      >
        {strings.capture.permissions.title}
      </Text>
      <Text className="type-body text-text-muted text-center">
        {strings.capture.permissions.message}
      </Text>
      <Button className="mt-5 self-stretch" onPress={onAllow}>
        {strings.capture.permissions.grant}
      </Button>
    </View>
  );
}
