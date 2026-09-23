import { strings } from "@/constants/Strings";
import type { CaptureCategory } from "@/types/Capture";
import { Text, View } from "react-native";

const CORNER = "absolute w-[34px] h-[34px] border-white";

interface FramingGuideProps {
  category: CaptureCategory;
  locked: boolean;
}

/** Corner brackets plus a per-category framing hint; dimmed until GPS locks. */
export function FramingGuide({ category, locked }: FramingGuideProps) {
  const hint = locked
    ? strings.capture.hint[category]
    : strings.capture.hint.waiting;
  return (
    <View
      className="absolute inset-0 items-center justify-center"
      pointerEvents="none"
    >
      <View
        importantForAccessibility="no-hide-descendants"
        className={`w-[55%] h-[45%] ${locked ? "opacity-100" : "opacity-45"}`}
      >
        <View
          className={`${CORNER} left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-lg`}
        />
        <View
          className={`${CORNER} right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-lg`}
        />
        <View
          className={`${CORNER} left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-lg`}
        />
        <View
          className={`${CORNER} right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-lg`}
        />
      </View>
      <View className="mt-5 max-w-[320px] px-3.5 py-2 rounded-[18px] bg-camera/80">
        <Text className="font-body-medium text-[14px] leading-[20px] text-white text-center">
          {hint}
        </Text>
      </View>
    </View>
  );
}
