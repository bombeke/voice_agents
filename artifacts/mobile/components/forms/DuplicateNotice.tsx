import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { fill } from "@/helpers/format";
import { formatShortDate } from "@/helpers/tagForm";
import type { DuplicateCandidate, DuplicateChoice } from "@/types/Capture";
import { Pressable, Text, View } from "react-native";

const CHOICES: { value: DuplicateChoice; label: string }[] = [
  { value: "update", label: strings.capture.tag.updateExisting },
  { value: "new", label: strings.capture.tag.newAsset },
];

interface DuplicateNoticeProps {
  duplicate: DuplicateCandidate;
  choice: DuplicateChoice | null;
  onChoose: (choice: DuplicateChoice) => void;
  disabled?: boolean;
}

/** §4.2: an asset of the same class within 5 m. Update it, or record a new one? */
export function DuplicateNotice({
  duplicate,
  choice,
  onChoose,
  disabled,
}: DuplicateNoticeProps) {
  const message = fill(strings.capture.tag.duplicateMessage, {
    label: duplicate.label?.toLowerCase() ?? strings.capture.tag.duplicateAsset,
    id: duplicate.id,
    distance: duplicate.distanceM.toFixed(1),
    date: formatShortDate(duplicate.capturedAt),
  });
  return (
    <View className="rounded-2xl bg-warning-soft p-4 gap-3">
      <View className="flex-row items-start gap-2.5">
        <Icon name="warning" size={22} color={colors.warning} />
        <Text className="flex-1 type-body text-on-warning-soft">
          <Text className="type-body-strong text-on-warning-soft">
            {strings.capture.tag.duplicateTitle}
          </Text>{" "}
          {message}
        </Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={strings.capture.tag.duplicateTitle}
        className="gap-2"
      >
        {CHOICES.map(({ value, label }) => {
          const selected = value === choice;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => onChoose(value)}
              className={`min-h-[52px] px-4 flex-row items-center gap-3 rounded-xl bg-surface border active:opacity-85 disabled:opacity-40 ${
                selected ? "border-primary" : "border-surface"
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selected ? "border-primary" : "border-text-muted"
                }`}
              >
                {selected ? (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                ) : null}
              </View>
              <Text className="flex-1 type-body-strong text-text">{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
