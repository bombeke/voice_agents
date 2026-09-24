import { isRecordFilter } from "@/helpers/records";
import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { PERMISSIONS } from "@/services/auth/Roles";
import { RecordsView } from "@/views/RecordsView";
import { useLocalSearchParams } from "expo-router";

/** Takes `?filter=all|pending|flagged`, e.g. "pending" from Home's badge. */
export default function Records() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const { claims } = useAuth();
  return (
    <RecordsView
      filter={isRecordFilter(filter) ? filter : undefined}
      canSeeTeam={hasPerm(claims ?? null, PERMISSIONS.RECORDS_READ_TEAM)}
    />
  );
}
