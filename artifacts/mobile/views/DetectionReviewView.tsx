import { AttributePicker } from "@/components/camera/AttributePicker";
import { CaptureStepHeader } from "@/components/camera/CaptureStepHeader";
import { DetectionCard } from "@/components/camera/DetectionCard";
import { ReplaceBaseSheet } from "@/components/camera/ReplaceBaseSheet";
import {
  ReviewPhoto,
  type NumberedDetection,
} from "@/components/camera/ReviewPhoto";
import { Button } from "@/components/ui/Button";
import { InfoNote } from "@/components/ui/InfoNote";
import { DETECTOR_MODEL_NAME } from "@/constants/DetectorModel";
import { strings } from "@/constants/Strings";
import { mostDetectedPhoto, reviewCategory } from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import { Routes } from "@/services/Routes";
import {
  acceptDetection,
  captureSession$,
  rejectDetection,
  replaceDetection,
  setAttribute,
  undoRejection,
} from "@/services/storage/CaptureSessionStore";
import type { AttributeKey, CaptureMetadata } from "@/types/Capture";
import { useSelector } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

/** A photo can be re-placed on when it has a pose to cast rays from. */
function canReplace(meta: CaptureMetadata | undefined) {
  return !!(meta?.ar || meta?.sensor);
}

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
  const [replacing, setReplacing] = useState<number | null>(null);
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
  const metadataById = useMemo(
    () =>
      new Map<string, CaptureMetadata>(
        session.photos.flatMap((p) =>
          p.metadata ? [[p.id, p.metadata] as const] : [],
        ),
      ),
    [session.photos],
  );
  const photoMetadata = useMemo(() => {
    const shown = session.photos.find((p) => p.imageUri === photoUri);
    return shown?.metadata ?? null;
  }, [session.photos, photoUri]);
  // The design's green note: shown once anything was ranged on the phone.
  const ranged = detections.some(
    (d) => d.position && d.position.source !== "device",
  );
  const replacingDetection =
    detections.find((d) => d.trackId === replacing) ?? null;
  const replacingMetadata = replacingDetection?.photoId
    ? metadataById.get(replacingDetection.photoId)
    : undefined;
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

  const continueToTagging = async () => {
    await session.startTagging();
    router.push(Routes.CAPTURE_TAG);
  };

  const subtitle = fill(strings.capture.review.subtitle, {
    category: resolvedCategory
      ? strings.categories[resolvedCategory].label
      : strings.capture.review.autoCategory,
    count: detections.length,
    model: DETECTOR_MODEL_NAME,
  });
  const inferenceMs = photoMetadata?.detector.inferenceMs ?? null;

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
          {ranged ? (
            <InfoNote
              tone="success"
              title={strings.capture.review.onDeviceTitle}
            >
              {inferenceMs === null
                ? strings.capture.review.onDeviceUntimed
                : fill(strings.capture.review.onDevice, { ms: inferenceMs })}
            </InfoNote>
          ) : null}
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
              metadata={
                detection.photoId
                  ? metadataById.get(detection.photoId)
                  : undefined
              }
              onReplace={
                detection.photoId &&
                canReplace(metadataById.get(detection.photoId))
                  ? () => setReplacing(detection.trackId)
                  : undefined
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

      <ReplaceBaseSheet
        detection={replacingDetection}
        photoSize={replacingMetadata?.intrinsics ?? { width: 0, height: 0 }}
        onClose={() => setReplacing(null)}
        onPlace={(at) => {
          const meta = replacingMetadata;
          if (!replacingDetection || !meta) return false;
          return replaceDetection(replacingDetection.trackId, {
            x: at.x * meta.intrinsics.width,
            y: at.y * meta.intrinsics.height,
          });
        }}
      />

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
