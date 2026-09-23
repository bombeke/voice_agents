import { parseCaptureCategory } from "@/helpers/captureCategory";
import { CaptureView } from "@/views/CaptureView";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function CaptureScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return (
    <>
      <StatusBar style="light" />
      <CaptureView category={parseCaptureCategory(category)} />
    </>
  );
}
