import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { Text, View } from "react-native";

/** Placeholder supervisor Review tab. */
export function ReviewQueueView() {
  return (
    <View className="flex-1 bg-background pt-safe-offset-6 px-5 gap-3">
      <Text accessibilityRole="header" className="type-h1 text-text">
        {strings.review.title}
      </Text>
      <InfoNote>{strings.review.comingSoon}</InfoNote>
    </View>
  );
}
