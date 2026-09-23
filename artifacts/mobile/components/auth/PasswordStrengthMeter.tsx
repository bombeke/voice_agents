import { strings } from "@/constants/Strings";
import {
  passwordStrength,
  type PasswordStrength,
} from "@/helpers/registration";
import { Text, View } from "react-native";

const t = strings.register;

const FILLED: Record<PasswordStrength, string> = {
  weak: "bg-danger",
  fair: "bg-warning",
  strong: "bg-success",
  veryStrong: "bg-success",
};

/** Four 4 px bars and a caption: "Strong · at least 10 characters with a number". */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, strength } = passwordStrength(password);
  const caption = strength
    ? `${t.strength[strength]} · ${t.passwordRule}`
    : t.passwordHint;

  return (
    <View className="gap-1.5">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-row gap-1"
      >
        {[1, 2, 3, 4].map((bar) => (
          <View
            key={bar}
            className={`flex-1 h-1 rounded-xs ${
              strength && bar <= score ? FILLED[strength] : "bg-border"
            }`}
          />
        ))}
      </View>
      <Text className="type-caption text-text-muted">{caption}</Text>
    </View>
  );
}
