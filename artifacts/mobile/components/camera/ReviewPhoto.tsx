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
import { Fragment, useState } from "react";
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
/** The dashed ground ellipse at a ranged asset's base. */
const GROUND_W = 64;
const GROUND_H = 18;

/**
 * The captured photo with its numbered boxes (§3 step 7): solid for
 * pre-accepted detections, dashed for suggestions awaiting a tap. Ranged
 * assets get the AR ground point at their base and their distance.
 */
export function ReviewPhoto({ imageUri, detections }: ReviewPhotoProps) {
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [photo, setPhoto] = useState<Size>({ width: 0, height: 0 });
  const shown = detections.filter((d) => d.detection.decision !== "rejected");
  const ranged = shown.some((d) => isRanged(d.detection));

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
            const base = isRanged(detection) ? detection.position! : null;
            const inclination = detection.attributes.find(
              (a) => a.key === "inclination",
            )?.value;
            return (
              <Fragment key={detection.trackId}>
                <View
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
                  {inclination && !suggested ? (
                    <View className="absolute left-1/2 top-[30%] bottom-0 border-l-2 border-dashed border-surface">
                      <Text className="absolute left-1 top-0 type-chip text-surface">
                        {`${inclination}°`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {base ? (
                  <View
                    pointerEvents="none"
                    className="absolute items-center"
                    // Runtime geometry: centred under the box's base.
                    style={{
                      left: rect.left + rect.width / 2 - GROUND_W / 2,
                      top: rect.top + rect.height - GROUND_H / 2,
                      width: GROUND_W,
                    }}
                  >
                    <View className="w-full h-[18px] rounded-full border-2 border-dashed border-gps-locked" />
                    <View className="mt-1 px-2 py-0.5 rounded-md bg-camera/85">
                      <Text className="type-mono text-[12px] text-surface">
                        {fill(strings.capture.strip.range, {
                          distance: base.distanceM.toFixed(1),
                        })}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Fragment>
            );
          })
        : null}

      <View className="absolute left-3 right-3 bottom-3 flex-row flex-wrap gap-2">
        <LegendPill kind="accepted" />
        <LegendPill kind={ranged ? "ground" : "suggested"} />
      </View>
    </View>
  );
}

function LegendPill({ kind }: { kind: "accepted" | "suggested" | "ground" }) {
  const r = strings.capture.review;
  const text =
    kind === "accepted"
      ? r.legendAccepted
      : kind === "ground"
        ? r.legendGround
        : r.legendSuggested;
  const swatch =
    kind === "accepted"
      ? "h-1 rounded-xs bg-accent"
      : kind === "ground"
        ? "h-3 rounded-full border-2 border-dashed border-gps-locked"
        : "border-t-2 border-dashed border-surface";
  return (
    <View className="h-8 px-3 rounded-full bg-camera/85 flex-row items-center gap-2">
      <View className={`w-5 ${swatch}`} />
      <Text className="type-chip text-surface">{text}</Text>
    </View>
  );
}

/** Ranged from the AR session (not the phone's own fix). */
function isRanged(detection: ReviewDetection): boolean {
  return !!detection.position && detection.position.source !== "device";
}
