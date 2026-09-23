import { Input, InputProps } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { useState } from "react";
import { Pressable, View } from "react-native";

/** Password field with a 44 px show/hide toggle inside its right edge. */
export function PasswordInput({ ref, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="justify-center">
      <Input
        ref={ref}
        className="pr-14"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        {...props}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          visible ? strings.auth.hidePassword : strings.auth.showPassword
        }
        onPress={() => setVisible((v) => !v)}
        className="absolute right-1 w-11 h-11 items-center justify-center rounded-pill-button active:bg-surface-muted"
      >
        <Icon
          name={visible ? "eye-off" : "eye"}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}
