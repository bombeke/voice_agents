import { strings } from "@/constants/Strings";
import * as Haptics from "expo-haptics";
import { Alert, Platform } from "react-native";

/** Light haptic tick for primary actions (no-op on web). */
export function tapFeedback() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/** Placeholder for options that are designed but not built yet. */
export function comingSoon() {
  Alert.alert(strings.auth.comingSoonTitle, strings.auth.comingSoonMessage);
}
