import { AppLogo } from "@/components/auth/AppLogo";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icons";
import { InfoNote } from "@/components/ui/InfoNote";
import { Input } from "@/components/ui/Input";
import { TextLink } from "@/components/ui/TextLink";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import {
  EMPTY_REGISTRATION,
  REGISTRATION_FIELDS,
  type RegistrationField,
  type RegistrationForm,
  toRegistration,
  validateRegistration,
} from "@/helpers/registration";
import { useRegister } from "@/hooks/useRegister";
import { comingSoon, tapFeedback } from "@/services/Feedback";
import { Routes } from "@/services/Routes";
import { useRouter } from "expo-router";
import { ReactNode, RefObject, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

const t = strings.register;

const TERMS_LABEL = `${t.termsPrefix}${t.termsOfUse}${t.termsJoin}${t.privacyPolicy}${t.termsSuffix}`;

type TextField = Exclude<RegistrationField, "acceptedTerms">;

function InlineLink({ label }: { label: string }) {
  return (
    <Text
      accessibilityRole="link"
      onPress={comingSoon}
      className="type-label text-primary underline"
    >
      {label}
    </Text>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-6 pt-safe-offset-5 pb-safe-offset-7"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Register screen (design/screens/Register.png). */
export function RegisterView() {
  const router = useRouter();
  const register = useRegister();
  const [form, setForm] = useState<RegistrationForm>(EMPTY_REGISTRATION);
  // Errors stay hidden until the first submit, then track every edit.
  const [showErrors, setShowErrors] = useState(false);

  const inputs: Record<TextField, RefObject<TextInput | null>> = {
    name: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    confirmPassword: useRef<TextInput>(null),
  };

  const errors = useMemo(() => validateRegistration(form), [form]);
  const errorFor = (field: RegistrationField) => {
    const key = showErrors ? errors[field] : undefined;
    return key && t.errors[key];
  };

  const { busy } = register;

  const update = <K extends RegistrationField>(
    field: K,
    value: RegistrationForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (register.error) register.reset();
  };

  const focus = (field: TextField) => () => inputs[field].current?.focus();

  const toSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.LOGIN as never);
  };

  const submit = () => {
    if (busy) return;
    const firstInvalid = REGISTRATION_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      setShowErrors(true);
      if (firstInvalid !== "acceptedTerms") {
        inputs[firstInvalid].current?.focus();
      }
      return;
    }
    tapFeedback();
    register.submit(toRegistration(form));
  };

  if (register.done) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-3.5">
          <View className="w-14 h-14 rounded-full bg-success-soft items-center justify-center">
            <Icon name="check" size={28} color={colors.success} />
          </View>
          <Text accessibilityRole="header" className="type-h1 text-text">
            {t.successTitle}
          </Text>
          <Text className="type-body text-text-muted">
            {`${t.successSentTo} `}
            <Text className="type-body-strong text-text">
              {toRegistration(form).email}
            </Text>
            .
          </Text>
          <Text className="type-body text-text-muted">{t.successNext}</Text>
          <Button className="mt-4 h-14" onPress={toSignIn}>
            {t.back}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="-ml-3 flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={toSignIn}
          className="w-11 h-11 items-center justify-center rounded-pill-button active:bg-surface-muted"
        >
          <Icon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <AppLogo size={32} />
      </View>

      <Text
        accessibilityRole="header"
        className="mt-4 mb-1.5 type-display text-text"
      >
        {t.title}
      </Text>
      <Text className="mb-7 type-body text-text-muted">{t.subtitle}</Text>

      <View className="gap-4.5">
        <FormField label={t.nameLabel} error={errorFor("name")}>
          <Input
            ref={inputs.name}
            accessibilityLabel={t.nameLabel}
            invalid={!!errorFor("name")}
            value={form.name}
            onChangeText={(v) => update("name", v)}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={focus("email")}
            editable={!busy}
          />
        </FormField>

        <FormField label={t.emailLabel} error={errorFor("email")}>
          <Input
            ref={inputs.email}
            accessibilityLabel={t.emailLabel}
            invalid={!!errorFor("email")}
            value={form.email}
            onChangeText={(v) => update("email", v)}
            placeholder={t.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={focus("phone")}
            editable={!busy}
          />
        </FormField>

        <FormField label={t.phoneLabel} optional error={errorFor("phone")}>
          <Input
            ref={inputs.phone}
            accessibilityLabel={t.phoneLabel}
            invalid={!!errorFor("phone")}
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            placeholder={t.phonePlaceholder}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={focus("password")}
            editable={!busy}
          />
        </FormField>

        <FormField
          label={t.passwordLabel}
          error={errorFor("password")}
          footer={<PasswordStrengthMeter password={form.password} />}
        >
          <PasswordInput
            ref={inputs.password}
            accessibilityLabel={t.passwordLabel}
            invalid={!!errorFor("password")}
            value={form.password}
            onChangeText={(v) => update("password", v)}
            autoComplete="new-password"
            textContentType="newPassword"
            passwordRules="minlength: 10; required: digit;"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={focus("confirmPassword")}
            editable={!busy}
          />
        </FormField>

        <FormField
          label={t.confirmPasswordLabel}
          error={errorFor("confirmPassword")}
        >
          <PasswordInput
            ref={inputs.confirmPassword}
            accessibilityLabel={t.confirmPasswordLabel}
            invalid={!!errorFor("confirmPassword")}
            value={form.confirmPassword}
            onChangeText={(v) => update("confirmPassword", v)}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            editable={!busy}
          />
        </FormField>

        <View className="mt-1 gap-1">
          <Checkbox
            label={TERMS_LABEL}
            checked={form.acceptedTerms}
            onCheckedChange={(v) => update("acceptedTerms", v)}
            disabled={busy}
          >
            {t.termsPrefix}
            <InlineLink label={t.termsOfUse} />
            {t.termsJoin}
            <InlineLink label={t.privacyPolicy} />
            {t.termsSuffix}
          </Checkbox>
          {errorFor("acceptedTerms") && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="type-caption text-danger"
            >
              {errorFor("acceptedTerms")}
            </Text>
          )}
        </View>
      </View>

      <View className="mt-6">
        <InfoNote>{t.verificationNote}</InfoNote>
      </View>

      {register.error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-4 type-body-small text-danger"
        >
          {t.submitErrors[register.error]}
        </Text>
      )}

      <Button
        accessibilityLabel={t.submit}
        className="mt-5 h-14"
        disabled={busy}
        onPress={submit}
      >
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : t.submit}
      </Button>

      <View className="mt-2 flex-row items-center justify-center gap-1.5">
        <Text className="type-body-small text-text-muted">{t.haveAccount}</Text>
        <TextLink label={t.signIn} onPress={toSignIn} />
      </View>
    </Screen>
  );
}
