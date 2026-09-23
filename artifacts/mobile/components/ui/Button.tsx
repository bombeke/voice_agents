import { ReactNode } from "react";
import { Pressable, PressableProps, Text } from "react-native";

type ButtonVariant = "primary" | "secondary" | "dark";

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-primary active:bg-primary-pressed",
  secondary: "bg-surface border border-border-strong active:bg-surface-muted",
  dark: "bg-text active:opacity-85",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-on-primary",
  secondary: "text-text",
  dark: "text-surface",
};

interface ButtonProps extends Omit<PressableProps, "children"> {
  /** A string renders as the styled label; anything else is used as-is. */
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

/** 52 px button (radius 14). Works as a `<Link asChild>` child. */
export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`h-[52px] px-5 flex-row items-center justify-center gap-2 rounded-button disabled:opacity-40 ${CONTAINER[variant]} ${className}`}
      {...rest}
    >
      {typeof children === "string" ? (
        <Text className={`type-body-strong ${LABEL[variant]}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
