import { RECORD_FILTERS, type RecordFilter } from "@/helpers/records";
import { RecordsView } from "@/views/RecordsView";
import { useLocalSearchParams } from "expo-router";

/** Takes `?id=` (capture id or asset code) and `?filter=all|pending|flagged`. */
export default function Records() {
  const { id, filter } = useLocalSearchParams<{
    id?: string;
    filter?: string;
  }>();
  const tab = RECORD_FILTERS.find((f) => f === filter) as
    RecordFilter | undefined;
  return <RecordsView focusId={id} filter={tab} />;
}
