import { LocationSummary } from "@/components/camera/LocationSummary";
import { CaptureStepHeader } from "@/components/camera/CaptureStepHeader";
import { CategoryGrid } from "@/components/forms/CategoryGrid";
import { CommentInput } from "@/components/forms/CommentInput";
import { DuplicateNotice } from "@/components/forms/DuplicateNotice";
import { StatusChips } from "@/components/forms/StatusChips";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FUNCTIONAL_OPTIONS } from "@/constants/Statuses";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import {
  statusesFor,
  tagFormProblem,
  tagSubtitle,
  type TagProblem,
} from "@/helpers/tagForm";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import { useDictation } from "@/hooks/useDictation";
import { Routes } from "@/services/Routes";
import {
  appendComment,
  captureSession$,
  setComment,
  setDuplicateChoice,
  setFunctional,
  setTagCategory,
  toggleStatus,
} from "@/services/storage/CaptureSessionStore";
import { useSelector } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

const PROBLEM_TEXT: Record<TagProblem, string> = {
  category: strings.capture.tag.needCategory,
  status: strings.capture.tag.needStatus,
  duplicate: strings.capture.tag.needDuplicate,
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <View className="gap-0.5">
        <Text accessibilityRole="header" className="type-title text-text">
          {title}
        </Text>
        {hint ? (
          <Text className="type-body-small text-text-muted">{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Capture step 3 of 3 (design/screens/Tagging form.png): confirm the
 * category, set the condition, whether it works, a comment, and answer a
 * possible duplicate. Saving records the capture; a draft skips the checks
 * and goes to a supervisor. The form lives in CaptureSessionStore, so going
 * back to review and returning keeps it.
 */
export function TaggingView() {
  const router = useRouter();
  const session = useCaptureSession();
  const form = useSelector(captureSession$.tagging);
  const detections = useSelector(captureSession$.detections);
  const dictation = useDictation(appendComment);
  const disabled = session.isSaving;

  const save = async (draft: boolean) => {
    if (await session.save({ draft })) router.dismissTo(Routes.HOME);
  };

  const problem = tagFormProblem(form, false);
  const canSaveDraft = !disabled && tagFormProblem(form, true) === null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <CaptureStepHeader
        title={strings.capture.tag.title}
        subtitle={tagSubtitle(detections)}
        step={strings.capture.tag.step}
        backLabel={strings.capture.tag.back}
        onBack={() => router.back()}
      />

      {form ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pt-2 pb-6 gap-6"
        >
          <Section title={strings.capture.tag.category}>
            <CategoryGrid
              label={strings.capture.tag.category}
              value={form.category}
              onChange={setTagCategory}
              disabled={disabled}
            />
          </Section>

          <Section
            title={strings.capture.tag.status}
            hint={strings.capture.tag.statusHint}
          >
            {form.category ? (
              <StatusChips
                options={statusesFor(form.category)}
                selected={form.statuses}
                onToggle={toggleStatus}
                disabled={disabled}
              />
            ) : (
              <Text className="type-body-small text-text-muted">
                {strings.capture.tag.pickCategoryFirst}
              </Text>
            )}
          </Section>

          <Section
            title={strings.capture.tag.functional}
            hint={strings.capture.tag.functionalHint}
          >
            <SegmentedControl
              label={strings.capture.tag.functional}
              options={FUNCTIONAL_OPTIONS}
              labels={strings.capture.tag.functionalOptions}
              value={form.functional}
              onChange={setFunctional}
              disabled={disabled}
            />
          </Section>

          <Section title={strings.capture.tag.comment}>
            <CommentInput
              label={strings.capture.tag.comment}
              placeholder={strings.capture.tag.commentPlaceholder}
              value={form.comment}
              onChangeText={setComment}
              disabled={disabled}
              dictation={dictation}
            />
          </Section>

          {form.duplicate ? (
            <DuplicateNotice
              duplicate={form.duplicate}
              choice={form.duplicateChoice}
              onChoose={setDuplicateChoice}
              disabled={disabled}
            />
          ) : null}

          {session.location ? (
            <LocationSummary location={session.location} />
          ) : null}
        </ScrollView>
      ) : (
        <View className="flex-1" />
      )}

      <View className="px-4 pt-3 pb-safe-offset-3 gap-2 bg-background border-t border-border">
        {problem && form ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center type-caption text-text-muted"
          >
            {PROBLEM_TEXT[problem]}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            className="flex-[2]"
            disabled={!canSaveDraft}
            onPress={() => save(true)}
          >
            {strings.capture.tag.saveDraft}
          </Button>
          <Button
            className="flex-[3]"
            disabled={disabled || problem !== null}
            accessibilityLabel={strings.capture.tag.save}
            accessibilityState={{
              disabled: disabled || problem !== null,
              busy: disabled,
            }}
            onPress={() => save(false)}
          >
            {disabled ? (
              <ActivityIndicator colorClassName="accent-on-primary" />
            ) : (
              <>
                <Icon name="check" size={20} color={colors.onPrimary} />
                <Text className="type-body-strong text-on-primary">
                  {strings.capture.tag.save}
                </Text>
              </>
            )}
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
