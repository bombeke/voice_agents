import { GuardedLayout } from "@/components/auth/GuardedLayout";
import { parseCaptureCategory } from "@/helpers/captureCategory";
import { CaptureView } from "@/views/CaptureView";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * Full-screen capture stack opened from the Home category tiles
 * (`/capture?category=energy|water|telecom|roads|auto`). It sits outside
 * `(tabs)`, so it carries its own auth guard.
 */
export default function CaptureScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return (
    <GuardedLayout>
      <StatusBar style="light" />
      <CaptureView category={parseCaptureCategory(category)} />
    </GuardedLayout>
  );
}
