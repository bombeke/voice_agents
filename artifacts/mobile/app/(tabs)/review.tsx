import { useAuth } from "@/providers/AuthProvider";
import { hasPerm } from "@/services/auth/AuthUtils";
import { Routes } from "@/services/Routes";
import { ReviewQueueView } from "@/views/ReviewQueueView";
import { Redirect } from "expo-router";

/** The tab is hidden without the permission; this keeps the URL closed too. */
export default function Review() {
  const { claims } = useAuth();
  if (!hasPerm(claims ?? null, "records:review")) {
    return <Redirect href={Routes.HOME} />;
  }
  return <ReviewQueueView />;
}
