import { AttributePicker } from "@/components/camera/AttributePicker";
import { CaptureStepHeader } from "@/components/camera/CaptureStepHeader";
import { DetectionCard } from "@/components/camera/DetectionCard";
import {
  ReviewPhoto,
  type NumberedDetection,
} from "@/components/camera/ReviewPhoto";
import { Button } from "@/components/ui/Button";
import { InfoNote } from "@/components/ui/InfoNote";
import { DETECTOR_MODEL_VERSION } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import { mostDetectedPhoto, reviewCategory } from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import { Routes } from "@/services/Routes";
import {
  acceptDetection,
  captureSession$,
  rejectDetection,
  setAttribute,
  undoRejection,
} from "@/services/storage/CaptureSessionStore";
import type { AttributeKey } from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

/**
 * Capture step 2 of 3 (design/screens/Review AI detections.png): the photo
 * with numbered boxes and one card per detection. The surveyor accepts or
 * rejects suggestions and corrects attributes, then continues to tagging
 * (/capture/tag).
 */
export function DetectionReviewView() {
  const router = useRouter();
  const session = useCaptureSession();
  const category = useSelector(captureSession$.category);
  const detections = useSelector(captureSession$.detections);

  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(
    // Only the first card starts open, as in the mockup.
    () => new Set(detections.slice(1).map((d) => d.trackId)),
  );
  const [editing, setEditing] = useState<{
    trackId: number;
    key: AttributeKey;
  } | null>(null);

  const numbered = useMemo<NumberedDetection[]>(
    () => detections.map((detection, i) => ({ detection, number: i + 1 })),
    [detections],
  );
  const photoUri = useMemo(
    () => mostDetectedPhoto(detections) ?? session.photos[0]?.imageUri ?? null,
    [detections, session.photos],
  );
  const resolvedCategory = reviewCategory(category, detections);
  const editingAttribute = editing
    ? (detections
        .find((d) => d.trackId === editing.trackId)
        ?.attributes.find((a) => a.key === editing.key) ?? null)
    : null;

  const toggle = (trackId: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(trackId)) next.add(trackId);
      return next;
    });

  const continueToTagging = () => {
    session.startTagging();
    router.push(Routes.CAPTURE_TAG);
  };

  const subtitle = fill(strings.capture.review.subtitle, {
    category: resolvedCategory
      ? strings.categories[resolvedCategory].label
      : strings.capture.review.autoCategory,
    count: detections.length,
    model: DETECTOR_MODEL_VERSION,
  });

  return (
    <View className="flex-1 bg-background">
      <CaptureStepHeader
        title={strings.capture.review.title}
        subtitle={subtitle}
        step={strings.capture.review.step}
        backLabel={strings.capture.review.back}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerClassName="pb-6">
        {photoUri ? (
          <ReviewPhoto
            imageUri={photoUri}
            detections={numbered.filter(
              (n) => n.detection.imageUri === photoUri,
            )}
          />
        ) : null}

        <View className="px-4 pt-4 gap-2.5">
          {numbered.length === 0 ? (
            <InfoNote>{strings.capture.review.noneFound}</InfoNote>
          ) : null}
          {numbered.map(({ detection, number }) => (
            <DetectionCard
              key={detection.trackId}
              detection={detection}
              number={number}
              expanded={!collapsed.has(detection.trackId)}
              onToggle={() => toggle(detection.trackId)}
              onAccept={() => acceptDetection(detection.trackId)}
              onReject={() => rejectDetection(detection.trackId)}
              onUndo={() => undoRejection(detection.trackId)}
              onEditAttribute={(key) =>
                setEditing({ trackId: detection.trackId, key })
              }
            />
          ))}
        </View>
      </ScrollView>

      <View className="px-4 pt-3 pb-safe-offset-3 flex-row gap-3 bg-background border-t border-border">
        <Button
          variant="secondary"
          className="flex-[2]"
          disabled={session.isFull}
          onPress={() => router.back()}
        >
          {strings.capture.review.addPhoto}
        </Button>
        <Button className="flex-[3]" onPress={continueToTagging}>
          {strings.capture.review.continue}
        </Button>
      </View>

      <AttributePicker
        attribute={editingAttribute}
        onClose={() => setEditing(null)}
        onPick={(value) => {
          if (editing) setAttribute(editing.trackId, editing.key, value);
          setEditing(null);
        }}
      />
    </View>
  );
}
