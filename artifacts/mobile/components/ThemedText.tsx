import { Text, type TextProps } from "react-native";

export type ThemedTextProps = TextProps & {
  className?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

const TYPES: Record<NonNullable<ThemedTextProps["type"]>, string> = {
  default: "type-body text-text",
  defaultSemiBold: "type-body-strong text-text",
  title: "type-display text-text",
  subtitle: "type-h2 text-text",
  link: "type-body-strong text-primary",
};

export function ThemedText({
  className = "",
  type = "default",
  ...rest
}: ThemedTextProps) {
  return <Text className={`${TYPES[type]} ${className}`} {...rest} />;
}
