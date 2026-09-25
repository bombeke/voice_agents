import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { PERMISSIONS } from "@/services/auth/Roles";
import { Routes } from "@/services/Routes";
import { ReviewQueueView } from "@/views/ReviewQueueView";
import { Redirect } from "expo-router";

/**
 * Everyone with their own records sees their review status; supervisors and
 * admins also review the team. Without either, the URL stays closed.
 */
export default function Review() {
  const { claims } = useAuth();
  const c = claims ?? null;
  if (!hasPerm(c, PERMISSIONS.REVIEW_READ_OWN)) {
    return <Redirect href={Routes.HOME} />;
  }
  return <ReviewQueueView canDecide={hasPerm(c, PERMISSIONS.REVIEW_DECIDE)} />;
}
