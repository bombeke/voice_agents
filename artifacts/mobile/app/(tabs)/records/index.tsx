import { isRecordFilter } from "@/helpers/records";
import { RecordsView } from "@/views/RecordsView";
import { useLocalSearchParams } from "expo-router";

/** Takes `?filter=all|pending|flagged`, e.g. "pending" from Home's badge. */
export default function Records() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  return <RecordsView filter={isRecordFilter(filter) ? filter : undefined} />;
}
