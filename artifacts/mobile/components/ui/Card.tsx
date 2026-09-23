import { ReactNode } from "react";
import { Pressable, View } from "react-native";

type CardVariant = "default" | "flush" | "dashed";

const VARIANT: Record<CardVariant, string> = {
  default: "p-4 bg-surface border-border",
  flush: "bg-surface border-border",
  dashed: "p-4 bg-transparent border-dashed border-border-strong",
};

interface CardProps {
  children: ReactNode;
  /**
   * `default` pads its content; `flush` has no padding, for list rows with
   * dividers; `dashed` is the "suggested" / secondary-action outline.
   */
  variant?: CardVariant;
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
}

/** White surface with a warm border (radius 16). */
export function Card({
  children,
  variant = "default",
  onPress,
  accessibilityLabel,
  className = "",
}: CardProps) {
  const cardClass = `border rounded-2xl overflow-hidden ${VARIANT[variant]} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={`${cardClass} active:bg-surface-muted`}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={cardClass}>{children}</View>;
}

/** Row divider for `flush` cards. */
export function CardDivider() {
  return <View className="h-px bg-surface-muted" />;
}
