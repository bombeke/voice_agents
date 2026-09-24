import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { Toggle } from "@/components/ui/Toggle";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";

/** What sits at the end of a row. */
export type SettingsTrailing =
  | { kind: "toggle"; value: boolean; onChange: (value: boolean) => void }
  /** Opens a picker or screen; without `onPress` it shows but is disabled. */
  | { kind: "nav"; value?: string; onPress?: () => void }
  /** Read-only fact, in mono (versions, times, hosts). */
  | { kind: "value"; value: string }
  /** Set by the administrator; the user can't change it. */
  | { kind: "locked"; value: string }
  | {
      kind: "action";
      label: string;
      onPress: () => void;
      disabled?: boolean;
    };

interface SettingsRowProps {
  label: string;
  hint?: string;
  /** Nothing when the row is only a statement. */
  trailing?: SettingsTrailing;
}

const ROW = "min-h-[58px] py-1.5 pl-4 pr-2 flex-row items-center gap-3";

function Labels({ label, hint }: { label: string; hint?: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text className="type-body text-text">{label}</Text>
      {hint ? (
        <Text className="type-caption text-text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

/** One line of a settings card: label, optional hint, and its control. */
export function SettingsRow({ label, hint, trailing }: SettingsRowProps) {
  // The whole row is the button, so the target is the full 58 px line.
  if (trailing?.kind === "nav") {
    const { value, onPress } = trailing;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : label}
        accessibilityHint={onPress ? undefined : strings.settings.unavailable}
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        className={`${ROW} active:bg-surface-muted`}
      >
        <Labels label={label} hint={hint} />
        <View
          className={`flex-row items-center gap-1 pl-2 ${onPress ? "" : "opacity-60"}`}
        >
          {value ? (
            <Text className="type-body-small text-text-muted">{value}</Text>
          ) : null}
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
    );
  }

  return (
    <View className={ROW}>
      <Labels label={label} hint={hint} />
      {!trailing ? null : trailing.kind === "toggle" ? (
        <Toggle
          value={trailing.value}
          onValueChange={trailing.onChange}
          accessibilityLabel={label}
        />
      ) : trailing.kind === "value" ? (
        <Text className="type-mono text-[13px] text-text pr-2">
          {trailing.value}
        </Text>
      ) : trailing.kind === "locked" ? (
        <View className="flex-row items-center gap-1.5 pr-2">
          <Text className="type-label text-text">{trailing.value}</Text>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={strings.settings.lockedLabel}
          >
            <Icon name="lock" size={16} color={colors.textMuted} />
          </View>
        </View>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mr-2"
          onPress={trailing.onPress}
          disabled={trailing.disabled}
        >
          {trailing.label}
        </Button>
      )}
    </View>
  );
}
