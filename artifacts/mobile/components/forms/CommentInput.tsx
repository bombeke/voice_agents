import { Icon } from "@/components/ui/Icons";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Accessible name; the visible label sits above the field. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  /** Voice input; the mic button is hidden when it isn't available. */
  dictation?: {
    available: boolean;
    listening: boolean;
    failed: boolean;
    toggle: () => void;
  };
}

/** Multi-line comment with an optional mic button for voice-to-text. */
export function CommentInput({
  value,
  onChangeText,
  label,
  placeholder,
  disabled,
  dictation,
}: CommentInputProps) {
  const mic = dictation?.available ? dictation : null;
  // The border wraps the field and the mic, so focus is tracked here.
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-1.5">
      <View
        className={`flex-row items-start bg-surface rounded-xl ${
          focused ? "border-2 border-accent" : "border border-border-strong"
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColorClassName="accent-text-muted"
          multiline
          textAlignVertical="top"
          className="flex-1 min-h-[104px] px-4 py-3 type-body text-text"
        />
        {mic ? (
          <Pressable
            onPress={mic.toggle}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              mic.listening
                ? strings.capture.tag.stopDictation
                : strings.capture.tag.dictate
            }
            accessibilityState={{ busy: mic.listening, disabled: !!disabled }}
            className={`m-2 w-11 h-11 rounded-full items-center justify-center disabled:opacity-40 ${
              mic.listening ? "bg-primary" : "bg-primary-soft active:opacity-85"
            }`}
          >
            <Icon
              name="mic"
              size={22}
              color={mic.listening ? colors.onPrimary : colors.primary}
            />
          </Pressable>
        ) : null}
      </View>
      {mic?.listening ? (
        <Text
          accessibilityLiveRegion="polite"
          className="type-caption text-primary"
        >
          {strings.capture.tag.listening}
        </Text>
      ) : mic?.failed ? (
        <Text
          accessibilityLiveRegion="polite"
          className="type-caption text-danger"
        >
          {strings.capture.tag.dictationFailed}
        </Text>
      ) : null}
    </View>
  );
}
