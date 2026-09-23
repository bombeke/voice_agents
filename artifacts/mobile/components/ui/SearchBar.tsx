import { Icon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { colors } from "@/constants/theme";
import { Pressable, View } from "react-native";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Accessible name of the field. */
  label: string;
  placeholder: string;
  /** Accessible name of the clear button. */
  clearLabel: string;
  autoFocus?: boolean;
}

/** Search field with a leading glyph and a clear button once typed in. */
export function SearchBar({
  value,
  onChangeText,
  label,
  placeholder,
  clearLabel,
  autoFocus,
}: SearchBarProps) {
  return (
    <View className="justify-center">
      <Input
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        className="pl-11 pr-12 rounded-button"
      />
      <View className="absolute left-3.5" pointerEvents="none">
        <Icon name="search" size={18} color={colors.textMuted} />
      </View>
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          className="absolute right-1 w-11 h-11 items-center justify-center rounded-full active:bg-surface-muted"
        >
          <Icon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
