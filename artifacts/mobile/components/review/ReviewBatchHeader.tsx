import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoNote } from "@/components/ui/InfoNote";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import { formatReviewWhen } from "@/helpers/reviewQueue";
import type { DownloadResult } from "@/services/sync/ReviewSync";
import type { ReviewBatch } from "@/types/Review";
import { Text, View } from "react-native";

const b = strings.review.batch;

interface ReviewBatchHeaderProps {
  batch: ReviewBatch | null;
  /** Decisions made here that the server hasn't confirmed. */
  unsent: number;
  online: boolean;
  downloading: boolean;
  /** Outcome of the last download this session, shown once. */
  lastDownload: DownloadResult | null;
  onDownload: () => void;
}

function downloadNote(result: DownloadResult | null): string | null {
  if (!result) return null;
  if (!result.ok) return result.reason === "offline" ? b.offline : b.failed;
  return result.added === 0
    ? b.nothingNew
    : fill(b.added, { count: result.added });
}

/**
 * The supervisor's batch: when it was downloaded, decisions still to upload,
 * and "Download next batch" (online only; reviewing works offline).
 */
export function ReviewBatchHeader({
  batch,
  unsent,
  online,
  downloading,
  lastDownload,
  onDownload,
}: ReviewBatchHeaderProps) {
  const note = online ? downloadNote(lastDownload) : b.offline;
  return (
    <Card className="gap-3">
      <View accessibilityLabel={b.label} className="gap-1">
        <Text className="type-body-strong text-text">
          {batch
            ? fill(b.summary, {
                size: batch.size,
                when: formatReviewWhen(new Date(batch.downloadedAt)),
              })
            : b.none}
        </Text>
        {unsent > 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            className="type-body-small text-text-muted"
          >
            {unsent === 1 ? b.unsentOne : fill(b.unsent, { count: unsent })}
          </Text>
        ) : null}
      </View>
      {note ? <InfoNote>{note}</InfoNote> : null}
      <Button
        variant={batch ? "secondary" : "primary"}
        disabled={!online || downloading}
        onPress={onDownload}
      >
        {downloading ? b.downloading : batch ? b.downloadNext : b.download}
      </Button>
    </Card>
  );
}
