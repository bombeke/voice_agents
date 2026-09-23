import { strings } from "@/constants/Strings";
import { ReactNode } from "react";
import { Text, View } from "react-native";

interface FormFieldProps {
  label: string;
  /** Adds a muted "(optional)" after the label. */
  optional?: boolean;
  /** Shown under the input and announced to screen readers. */
  error?: string;
  /** The input; give it `accessibilityLabel={label}`. */
  children: ReactNode;
  /** Extra content under the input, e.g. a strength meter. */
  footer?: ReactNode;
}

/** Label, input and error text stacked with a 6 px gap. */
export function FormField({
  label,
  optional,
  error,
  children,
  footer,
}: FormFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="type-label text-text">
        {label}
        {optional && (
          <Text className="type-body-small text-text-muted">
            {` ${strings.register.optional}`}
          </Text>
        )}
      </Text>
      {children}
      {footer}
      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="type-caption text-danger"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
