import { StatusBar } from "expo-status-bar";
import { ReactNode } from "react";
import { ScrollView, View } from "react-native";

interface PhoneScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. @default true */
  scroll?: boolean;
  /** Apply the horizontal screen gutter. @default true */
  padded?: boolean;
  /** Sticky bottom action area (e.g. "Save draft" / "Save record"). */
  footer?: ReactNode;
  /**
   * Pad for the bottom safe-area inset. Leave off inside tabs, where the
   * tab bar already covers it. @default false
   */
  bottomInset?: boolean;
  contentClassName?: string;
}

/** Root container for every screen: canvas colour, safe areas, gutter. */
export function PhoneScreen({
  children,
  scroll = true,
  padded = true,
  footer,
  bottomInset = false,
  contentClassName = "",
}: PhoneScreenProps) {
  const inset = bottomInset || footer;

  const content = [
    padded ? "px-5" : "",
    footer ? "" : inset ? "pb-safe-offset-6" : "pb-6",
    contentClassName,
  ].join(" ");

  return (
    <View className="flex-1 bg-background pt-safe">
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`grow ${content}`}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${content}`}>{children}</View>
      )}
      {footer ? (
        <View className="flex-row gap-3 pt-3 pb-safe-offset-3 px-5 bg-background border-t border-border">
          {footer}
        </View>
      ) : null}
    </View>
  );
}
