import { AppLogo } from "@/components/auth/AppLogo";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { API_URL } from "@/constants/Config";
import { strings } from "@/constants/Strings";
import { colors } from "@/constants/theme";
import { usePasswordSignIn } from "@/hooks/usePasswordSignIn";
import { useSsoSignIn } from "@/hooks/useSsoSignIn";
import type { AuthErrorCode } from "@/services/auth/AuthService";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

const t = strings.auth;

const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: t.errors.invalidCredentials,
  offline: t.errors.ssoOffline,
  sso_failed: t.errors.ssoFailed,
  server_unreachable: t.errors.serverUnreachable,
};

/** "iip.example.org" from the configured API base URL. */
const SERVER_HOST = API_URL.replace(/^[a-z]+:\/\//i, "").split("/")[0];

function tapFeedback() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function comingSoon() {
  Alert.alert(t.comingSoonTitle, t.comingSoonMessage);
}

function TextLink({
  label,
  onPress,
  className = "min-h-11",
}: {
  label: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={6}
      className={`justify-center ${className}`}
    >
      <Text className="type-label text-primary underline">{label}</Text>
    </Pressable>
  );
}

/** Sign in screen (design/screens/Sign in.png). */
export function SignInView() {
  const sso = useSsoSignIn();
  const password = usePasswordSignIn();
  const { isConnected } = useNetInfo();

  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const passwordRef = useRef<TextInput>(null);

  const busy = sso.busy || password.busy;
  const canSubmit = identifier.trim() !== "" && secret !== "" && !busy;
  const errorCode = sso.error ?? password.error;

  const startSso = () => {
    tapFeedback();
    password.reset();
    sso.start(keepSignedIn);
  };

  const submit = () => {
    if (!canSubmit) return;
    tapFeedback();
    sso.clearError();
    password.submit({ identifier, password: secret, persist: keepSignedIn });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-6 pt-safe-offset-12 pb-safe-offset-4"
      >
        <View className="gap-3.5">
          <AppLogo />
          <Text accessibilityRole="header" className="type-display text-text">
            {t.title}
          </Text>
          <Text className="type-body text-text-muted">{t.subtitle}</Text>
        </View>

        <View className="mt-7 gap-2.5">
          <Button variant="dark" disabled={busy} onPress={startSso}>
            {sso.busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Icon name="shield" size={20} color={colors.surface} />
                <Text className="type-body-strong text-surface">
                  {t.continueWithSso}
                </Text>
              </>
            )}
          </Button>
          <Button variant="secondary" disabled={busy} onPress={comingSoon}>
            <View className="w-[22px] h-[22px] rounded-full border-[1.5px] border-text items-center justify-center">
              <Text className="font-display text-xs text-text">G</Text>
            </View>
            <Text className="type-body-strong text-text">
              {t.continueWithGoogle}
            </Text>
          </Button>
        </View>

        <View className="my-5 flex-row items-center gap-3">
          <View className="flex-1 h-px bg-border" />
          <Text className="type-caption text-text-muted">
            {t.orWithUsername}
          </Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <View className="gap-3.5">
          <View className="gap-1.5">
            <Text className="type-label text-text">{t.usernameLabel}</Text>
            <Input
              accessibilityLabel={t.usernameLabel}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t.usernamePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
            />
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="type-label text-text">{t.passwordLabel}</Text>
              <TextLink
                label={t.forgotPassword}
                onPress={comingSoon}
                className="min-h-8"
              />
            </View>
            <PasswordInput
              ref={passwordRef}
              accessibilityLabel={t.passwordLabel}
              value={secret}
              onChangeText={setSecret}
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
            />
          </View>

          <Checkbox
            label={t.keepSignedIn}
            checked={keepSignedIn}
            onCheckedChange={setKeepSignedIn}
            disabled={busy}
          />

          {errorCode && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="type-body-small text-danger"
            >
              {ERROR_MESSAGES[errorCode]}
            </Text>
          )}

          <Button
            accessibilityLabel={t.signIn}
            className="h-14"
            disabled={!canSubmit}
            onPress={submit}
          >
            {password.busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              t.signIn
            )}
          </Button>

          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="type-body-small text-text-muted">
              {t.newToPlatform}
            </Text>
            <TextLink label={t.createAccount} onPress={comingSoon} />
          </View>
        </View>

        <View className="mt-auto pt-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <View
              accessible
              accessibilityLabel={
                isConnected === false ? t.serverOffline : t.serverOnline
              }
              className={`w-2 h-2 rounded-full ${
                isConnected === false ? "bg-text-muted" : "bg-success"
              }`}
            />
            <Text className="type-mono text-[12.5px] text-text-muted">
              {SERVER_HOST}
            </Text>
          </View>
          <TextLink label={t.changeServer} onPress={comingSoon} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
