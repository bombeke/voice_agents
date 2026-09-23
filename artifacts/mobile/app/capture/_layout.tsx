import { GuardedLayout } from "@/components/auth/GuardedLayout";
import { Stack } from "expo-router";

/**
 * Full-screen capture stack opened from the Home category tiles: the camera
 * (`/capture?category=energy|water|telecom|roads|auto`), the detection review
 * and the tagging form. It sits outside `(tabs)`, so it carries its own auth
 * guard. Only the camera screen needs a web stand-in (`index.tsx`).
 */
export default function CaptureLayout() {
  return (
    <GuardedLayout>
      <Stack screenOptions={{ headerShown: false }} />
    </GuardedLayout>
  );
}
