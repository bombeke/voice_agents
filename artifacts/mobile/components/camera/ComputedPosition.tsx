import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill, formatCoordinates } from "@/helpers/format";
import type { CaptureMetadata, DetectionPosition } from "@/types/Capture";
import { Text, View } from "react-native";
import { PositionDiagram } from "./PositionDiagram";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="basis-[45%] grow gap-0.5">
      <Text className="type-body-small text-text-muted">{label}</Text>
      <Text className="type-mono text-text">{value}</Text>
    </View>
  );
}

interface ComputedPositionProps {
  /** Detector class, for the diagram, e.g. "pole". */
  label: string;
  position: DetectionPosition;
  /** The photo's capture metadata, for the phone's own fix. */
  metadata?: CaptureMetadata;
  /** The asset dot's colour. */
  color: string;
  /** Only offered when the photo has an AR or sensor pose to re-project from. */
  onReplace?: () => void;
}

/**
 * Where the asset itself is (design: Review AI detections, "Computed
 * position"): how it was found, a sketch, its coordinates, range and bearing,
 * and how the accuracy adds up.
 */
export function ComputedPosition({
  label,
  position,
  metadata,
  color,
  onReplace,
}: ComputedPositionProps) {
  const r = strings.capture.review;
  const device = metadata?.device;
  const note =
    device && device.accuracy !== null
      ? fill(r.positionNote, {
          device: device.accuracy.toFixed(1),
          projection: position.projectionErrorM.toFixed(1),
          coordinates: formatCoordinates(
            device.latitude,
            device.longitude,
            6,
            r.deviceCoordinates,
          ),
        })
      : null;
  const ranged = position.source !== "device";

  return (
    <View className="px-4 py-4 gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="type-overline text-text-muted">
          {r.computedPosition}
        </Text>
        <Chip
          tone={position.rough ? "warning" : "success"}
          label={r.positionSource[position.source]}
        />
      </View>

      {ranged ? (
        <PositionDiagram
          label={label}
          distanceM={position.distanceM}
          bearingDeg={position.bearingDeg}
          color={color}
        />
      ) : null}

      <View className="flex-row flex-wrap gap-y-3 gap-x-4">
        <Field label={r.latitude} value={position.latitude.toFixed(7)} />
        <Field label={r.longitude} value={position.longitude.toFixed(7)} />
        {ranged ? (
          <Field
            label={r.distanceBearing}
            value={fill(r.distanceBearingValue, {
              distance: position.distanceM.toFixed(1),
              bearing: Math.round(position.bearingDeg),
            })}
          />
        ) : null}
        <Field
          label={r.positionAccuracy}
          value={
            position.accuracyM === null
              ? strings.capture.tag.notReported
              : fill(r.accuracyValue, {
                  accuracy: position.accuracyM.toFixed(1),
                })
          }
        />
      </View>

      {note && ranged ? (
        <Text className="type-body-small text-text-muted">{note}</Text>
      ) : null}

      {onReplace ? (
        <Button variant="secondary" onPress={onReplace}>
          <Icon name="crosshair" size={18} color={colors.text} />
          <Text className="type-body-strong text-text">{r.replace}</Text>
        </Button>
      ) : null}
    </View>
  );
}
