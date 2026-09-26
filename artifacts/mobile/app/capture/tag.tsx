import { peekDb } from "@/db/Current";
import { editRecord } from "@/services/storage/CaptureSessionStore";
import { getOwnRecord } from "@/services/storage/repos/CaptureRepo";
import { TaggingView } from "@/views/TaggingView";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

/** Capture step 3 of 3, or with `?recordId=` the form for a saved record. */
export default function TaggingScreen() {
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();

  // Fresh from the store each time, so an edit left unsaved is dropped.
  useEffect(() => {
    const db = peekDb();
    if (!recordId || !db) return;
    let cancelled = false;
    getOwnRecord(db.orm, recordId).then((own) => {
      if (own && !cancelled) editRecord(own.record);
    });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  return (
    <>
      <StatusBar style="dark" />
      <TaggingView />
    </>
  );
}
