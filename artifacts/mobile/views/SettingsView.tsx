import { AccountCard } from "@/components/settings/AccountCard";
import { ChoiceRow } from "@/components/settings/ChoiceRow";
import { SettingsRow } from "@/components/settings/SettingsRow";
import {
  SettingsHeading,
  SettingsSection,
} from "@/components/settings/SettingsSection";
import { SignOutPanel } from "@/components/settings/SignOutPanel";
import { StorageCard } from "@/components/settings/StorageCard";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { API_URL, TERMS_URL } from "@/constants/Config";
import { strings } from "@/constants/Strings";
import { fill } from "@/helpers/format";
import {
  displayName,
  formatAppVersion,
  formatBytes,
  formatLastSynced,
  hostOf,
  roleLabel,
} from "@/helpers/settings";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/providers/AuthProvider";
import type {
  BooleanSetting,
  PhotosPerAsset,
  ThemePreference,
} from "@/types/Settings";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { openBrowserAsync } from "expo-web-browser";
import { Alert, ScrollView, Text, View } from "react-native";

const s = strings.settings;

const APP_VERSION = formatAppVersion(
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
  Application.nativeBuildVersion,
);
const SERVER = hostOf(API_URL);

const PHOTO_COUNTS = [1, 2, 3] as const;
const PHOTO_COUNT_LABELS: Record<PhotosPerAsset, string> = {
  1: s.capture.photosPerAssetOne,
  2: fill(s.capture.photosPerAssetValue, { count: 2 }),
  3: fill(s.capture.photosPerAssetValue, { count: 3 }),
};
const openTerms = TERMS_URL
  ? () => openBrowserAsync(TERMS_URL as string)
  : undefined;
const THEMES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
  "outdoor",
];

/**
 * Profile tab (design/screens/Settings.png): the account, capture, sync, AI
 * model, privacy and general preferences, device storage, and sign-out with
 * a warning while records are still only on this device.
 */
export function SettingsView() {
  const { claims, org, authMethod, logout } = useAuth();
  const {
    settings,
    set,
    status,
    storage,
    pending,
    syncing,
    sync,
    downloadModel,
    clearSyncedPhotos,
  } = useSettings();

  const toggle = (key: BooleanSetting) => ({
    kind: "toggle" as const,
    value: settings[key],
    onChange: (value: boolean) => set(key, value),
  });

  const confirmClear = () =>
    Alert.alert(
      s.storage.clearTitle,
      fill(s.storage.clearMessage, {
        size: formatBytes(status.storage.syncedPhotosBytes),
      }),
      [
        { text: s.storage.cancel, style: "cancel" },
        { text: s.storage.clearConfirm, onPress: clearSyncedPhotos },
      ],
    );

  const update = status.model.update;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pt-safe-offset-6 pb-10 px-5 gap-[22px]"
      showsVerticalScrollIndicator={false}
    >
      <Text accessibilityRole="header" className="type-h1 text-text">
        {s.title}
      </Text>

      <AccountCard
        name={displayName(claims)}
        email={claims?.email}
        role={roleLabel(claims)}
        org={org}
        method={
          authMethod === "sso"
            ? s.account.sso
            : authMethod === "password"
              ? s.account.password
              : undefined
        }
        offlineSessionDays={status.offlineSessionDays}
        project={status.project}
      />

      <SettingsSection title={s.capture.title}>
        <SettingsRow
          label={s.capture.accuracyGate}
          hint={s.capture.accuracyGateHint}
          trailing={{
            kind: "locked",
            value: fill(s.capture.accuracyGateValue, {
              value: status.policy.accuracyGateM.toFixed(1),
            }),
          }}
        />
        <SettingsRow
          label={s.capture.gnss}
          hint={s.capture.gnssHint}
          trailing={{
            kind: "nav",
            value: status.gnssReceiver ?? s.capture.gnssNone,
          }}
        />
        <ChoiceRow
          label={s.capture.photosPerAsset}
          options={PHOTO_COUNTS}
          labels={PHOTO_COUNT_LABELS}
          value={settings.photosPerAsset}
          onChange={(n) => set("photosPerAsset", n)}
        />
        <ChoiceRow
          label={s.capture.photoQuality}
          options={["high", "standard"] as const}
          labels={s.capture.photoQualities}
          value={settings.photoQuality}
          onChange={(q) => set("photoQuality", q)}
        />
        <SettingsRow
          label={s.capture.framingGuides}
          trailing={toggle("framingGuides")}
        />
        <SettingsRow
          label={s.capture.voiceComments}
          trailing={toggle("voiceComments")}
        />
      </SettingsSection>

      <SettingsSection title={s.sync.title}>
        <SettingsRow
          label={s.sync.wifiOnly}
          hint={s.sync.wifiOnlyHint}
          trailing={toggle("wifiOnlyPhotos")}
        />
        <SettingsRow
          label={s.sync.background}
          trailing={toggle("backgroundSync")}
        />
        <SettingsRow
          label={s.sync.lastSynced}
          trailing={{
            kind: "value",
            value: formatLastSynced(status.lastSyncedAt),
          }}
        />
        {pending > 0 ? (
          <SettingsRow
            label={
              pending === 1
                ? s.sync.waitingOne
                : fill(s.sync.waiting, { count: pending })
            }
            trailing={{
              kind: "action",
              label: syncing ? s.sync.syncing : s.sync.syncNow,
              onPress: sync,
              disabled: syncing,
            }}
          />
        ) : (
          <SettingsRow label={s.sync.allSynced} />
        )}
      </SettingsSection>

      <SettingsSection title={s.model.title}>
        <SettingsRow
          label={s.model.onDevice}
          trailing={{ kind: "value", value: status.model.version }}
        />
        {update ? (
          <SettingsRow
            label={s.model.updateAvailable}
            hint={fill(s.model.updateHint, {
              version: update.version,
              size: formatBytes(update.sizeBytes),
              note: update.note,
            })}
            trailing={{
              kind: "action",
              label: s.model.download,
              onPress: downloadModel,
            }}
          />
        ) : null}
        <SettingsRow
          label={s.model.cloudEnrichment}
          hint={s.model.cloudEnrichmentHint}
          trailing={toggle("cloudEnrichment")}
        />
        <SettingsRow
          label={s.model.showConfidence}
          trailing={toggle("showAiConfidence")}
        />
      </SettingsSection>

      <SettingsSection title={s.privacy.title}>
        <SettingsRow
          label={s.privacy.blur}
          hint={s.privacy.blurHint}
          trailing={{
            kind: "locked",
            value: status.policy.blurFacesAndPlates
              ? s.privacy.on
              : s.privacy.off,
          }}
        />
        <SettingsRow
          label={s.privacy.biometric}
          trailing={toggle("biometricUnlock")}
        />
        <SettingsRow
          label={s.privacy.devices}
          trailing={{ kind: "nav", value: String(status.signedInDevices) }}
        />
      </SettingsSection>

      <SettingsSection title={s.general.title}>
        <ChoiceRow
          label={s.general.language}
          options={["en"] as const}
          labels={s.general.languages}
          value={settings.language}
          onChange={(l) => set("language", l)}
        />
        <ChoiceRow
          label={s.general.units}
          options={["metric", "imperial"] as const}
          labels={s.general.unitOptions}
          value={settings.units}
          onChange={(u) => set("units", u)}
        />
        <SettingsRow
          label={s.general.offlineTiles}
          trailing={{
            kind: "nav",
            value: status.offlineTiles ?? s.general.noTiles,
          }}
        />
      </SettingsSection>

      <SettingsSection title={s.about.title}>
        <SettingsRow
          label={s.about.appVersion}
          trailing={{ kind: "value", value: APP_VERSION }}
        />
        <SettingsRow
          label={s.about.server}
          trailing={{ kind: "value", value: SERVER }}
        />
        <SettingsRow
          label={s.about.terms}
          trailing={{
            kind: "nav",
            onPress: openTerms,
          }}
        />
      </SettingsSection>

      <View className="gap-2">
        <SettingsHeading>{s.appearance.title}</SettingsHeading>
        <Card className="gap-2.5">
          <Text className="type-body text-text">{s.appearance.theme}</Text>
          <SegmentedControl
            label={s.appearance.theme}
            options={THEMES}
            labels={s.appearance.themes}
            value={settings.theme}
            onChange={(t) => set("theme", t)}
            columns={2}
          />
          <Text className="type-caption text-text-muted">
            {s.appearance.outdoorHint}
          </Text>
        </Card>
      </View>

      <View className="gap-2">
        <SettingsHeading>{s.storage.title}</SettingsHeading>
        <StorageCard
          breakdown={storage}
          clearableBytes={status.storage.syncedPhotosBytes}
          onClear={confirmClear}
        />
      </View>

      <SignOutPanel pending={pending} onSignOut={logout} />
    </ScrollView>
  );
}
