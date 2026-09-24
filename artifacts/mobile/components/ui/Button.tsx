import { ReactNode } from "react";
import { Pressable, PressableProps, Text } from "react-native";

type ButtonVariant = "primary" | "secondary" | "dark" | "outline" | "danger";
type ButtonSize = "md" | "sm";

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-primary active:bg-primary-pressed",
  secondary: "bg-surface border border-border-strong active:bg-surface-muted",
  dark: "bg-text active:opacity-85",
  outline: "bg-surface border-[1.5px] border-primary active:bg-primary-soft",
  danger: "bg-surface border-[1.5px] border-danger active:bg-danger-soft",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-on-primary",
  secondary: "text-text",
  dark: "text-surface",
  outline: "text-primary",
  danger: "text-danger",
};

const SIZE: Record<ButtonSize, string> = {
  md: "h-[52px] px-5 rounded-button",
  sm: "h-10 px-3.5 rounded-xl",
};

interface ButtonProps extends Omit<PressableProps, "children"> {
  /** A string renders as the styled label; anything else is used as-is. */
  children: ReactNode;
  variant?: ButtonVariant;
  /** `sm` (40 px) is for actions inside a list row. */
  size?: ButtonSize;
  className?: string;
}

/** 52 px button (radius 14), or 40 px in rows. Works as a `<Link asChild>` child. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`flex-row items-center justify-center gap-2 disabled:opacity-40 ${SIZE[size]} ${CONTAINER[variant]} ${className}`}
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
