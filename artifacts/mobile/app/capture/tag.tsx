import { editRecord } from "@/services/storage/CaptureSessionStore";
import { records$ } from "@/services/storage/RecordStore";
import { TaggingView } from "@/views/TaggingView";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

/** Capture step 3 of 3, or with `?recordId=` the form for a saved record. */
export default function TaggingScreen() {
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();

  // Fresh from the store each time, so an edit left unsaved is dropped.
  useEffect(() => {
    if (!recordId) return;
    const record = records$[recordId].peek();
    if (record) editRecord(record);
  }, [recordId]);

  return (
    <>
      <StatusBar style="dark" />
      <TaggingView />
    </>
  );
}
