import { strings } from "@/constants/Strings";
import type { Size } from "@/helpers/detectionGeometry";
import {
  formatConfidence,
  formatLabel,
  photoRect,
} from "@/helpers/detectionReview";
import { fill } from "@/helpers/format";
import { toFileUri } from "@/services/storage/ImageStore";
import type { ReviewDetection } from "@/types/Capture";
import { useState } from "react";
import { Image, Text, View } from "react-native";

export interface NumberedDetection {
  detection: ReviewDetection;
  /** 1-based, shared with the detection cards. */
  number: number;
}

interface ReviewPhotoProps {
  imageUri: string;
  /** Detections whose best sighting is this photo; rejected ones are skipped. */
  detections: NumberedDetection[];
}

/** Put the label inside the box when there's no room above it. */
const LABEL_ROOM = 28;

/**
 * The captured photo with its numbered boxes (§3 step 7): solid for
 * pre-accepted detections, dashed for suggestions awaiting a tap.
 */
export function ReviewPhoto({ imageUri, detections }: ReviewPhotoProps) {
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [photo, setPhoto] = useState<Size>({ width: 0, height: 0 });
  const shown = detections.filter((d) => d.detection.decision !== "rejected");

  return (
    <View className="w-full aspect-square bg-camera overflow-hidden">
      {/* Fills the frame, so its layout is the frame's. */}
      <Image
        source={{ uri: toFileUri(imageUri) }}
        resizeMode="contain"
        className="absolute inset-0"
        accessible
        accessibilityRole="image"
        accessibilityLabel={fill(strings.capture.review.photoSummary, {
          count: shown.length,
        })}
        onLayout={(e) => setView(e.nativeEvent.layout)}
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          setPhoto({ width, height });
        }}
      />

      {view.width > 0 && photo.width > 0
        ? shown.map(({ detection, number }) => {
            const rect = photoRect(detection.box, photo, view);
            const suggested = detection.decision === "suggested";
            return (
              <View
                key={detection.trackId}
                pointerEvents="none"
                className={`absolute rounded border-[3px] ${suggested ? "border-dashed border-surface" : "border-accent"}`}
                style={rect}
              >
                <View
                  className={`absolute left-[-3px] px-2 py-0.5 rounded ${suggested ? "bg-surface" : "bg-accent"}`}
                  style={{ top: rect.top < LABEL_ROOM ? 0 : -LABEL_ROOM }}
                >
                  <Text numberOfLines={1} className="type-chip text-text">
                    {fill(strings.capture.review.boxLabel, {
                      index: number,
                      label: formatLabel(detection.label),
                      confidence: formatConfidence(detection.confidence),
                    })}
                  </Text>
                </View>
              </View>
            );
          })
        : null}

      <View className="absolute left-3 right-3 bottom-3 flex-row flex-wrap gap-2">
        <LegendPill suggested={false} />
        <LegendPill suggested />
      </View>
    </View>
  );
}

function LegendPill({ suggested }: { suggested: boolean }) {
  return (
    <View className="h-8 px-3 rounded-full bg-camera/85 flex-row items-center gap-2">
      <View
        className={`w-5 ${suggested ? "border-t-2 border-dashed border-surface" : "h-1 rounded-xs bg-accent"}`}
      />
      <Text className="type-chip text-surface">
        {suggested
          ? strings.capture.review.legendSuggested
          : strings.capture.review.legendAccepted}
      </Text>
    </View>
  );
}
