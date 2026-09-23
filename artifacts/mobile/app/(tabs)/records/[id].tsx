import { RecordDetailView } from "@/views/RecordDetailView";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";

/** One record: `id` is a capture id or an asset code. */
export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <StatusBar style="light" />
      <RecordDetailView id={id} />
    </>
  );
}
