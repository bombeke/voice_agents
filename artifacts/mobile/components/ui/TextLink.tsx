import { Pressable, Text } from "react-native";

interface TextLinkProps {
  label: string;
  onPress: () => void;
  /** Row height; keep ≥ 44 px (`min-h-11`) unless the row around it is. */
  className?: string;
}

/** Underlined primary-colour link with a comfortable touch target. */
export function TextLink({
  label,
  onPress,
  className = "min-h-11",
}: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={6}
      className={`justify-center ${className}`}
    >
      <Text className="type-label text-primary underline">{label}</Text>
    </Pressable>
  );
}
