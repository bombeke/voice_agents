import type { PropsWithChildren, ReactElement } from "react";
import { View } from "react-native";
import { ThemedView } from "../components/ThemedView";

type Props = PropsWithChildren<{
  headerImage?: ReactElement | null;
  /** Tailwind background class for the header, e.g. `bg-primary-soft`. */
  headerClassName?: string;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerClassName = "",
}: Props) {
  return (
    <ThemedView className="flex-1">
      <View className={`h-[250px] overflow-hidden ${headerClassName}`}>
        {headerImage}
      </View>
      <ThemedView className="flex-1 p-8 gap-4 overflow-hidden">
        {children}
      </ThemedView>
    </ThemedView>
  );
}
