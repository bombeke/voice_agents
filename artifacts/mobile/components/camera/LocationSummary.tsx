import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import type { CaptureLocation } from "@/types/Capture";
import { Text, View } from "react-native";

const ELEVATION = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function Field({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <View className="basis-[45%] grow gap-0.5">
      <Text className="type-body-small text-text-muted">{label}</Text>
      <Text className={`type-mono ${good ? "text-success" : "text-text"}`}>
        {value}
      </Text>
    </View>
  );
}

/** The stamped fix: coordinates, elevation, accuracy and satellites. */
export function LocationSummary({ location }: { location: CaptureLocation }) {
  const { notReported } = strings.capture.tag;
  const unverified = location.flags.includes("gps_unverified");
  const accuracy =
    location.accuracy === null
      ? notReported
      : [
          fill(strings.capture.tag.accuracyValue, {
            accuracy: location.accuracy.toFixed(1),
          }),
          location.satellites === null
            ? null
            : fill(strings.capture.tag.satellites, {
                count: location.satellites,
              }),
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <View className="rounded-2xl bg-surface border border-border p-4 gap-3">
      <View className="flex-row flex-wrap gap-y-3 gap-x-4">
        <Field
          label={strings.capture.tag.latitude}
          value={location.latitude.toFixed(7)}
        />
        <Field
          label={strings.capture.tag.longitude}
          value={location.longitude.toFixed(7)}
        />
        <Field
          label={strings.capture.tag.elevation}
          value={
            location.altitude === null
              ? notReported
              : fill(strings.capture.tag.elevationValue, {
                  value: ELEVATION.format(location.altitude),
                })
          }
        />
        <Field
          label={strings.capture.tag.accuracy}
          value={accuracy}
          good={!unverified && location.accuracy !== null}
        />
      </View>
      {unverified ? (
        <Text className="type-caption text-warning">
          {strings.capture.tag.draftLocation}
        </Text>
      ) : null}
    </View>
  );
}
