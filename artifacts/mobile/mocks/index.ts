import { axiosClient } from "@/services/Api";
import type { Claims } from "@/types/Auth";
import MockAdapter from "axios-mock-adapter";
import type { AuthSessionResult } from "expo-auth-session";
import { jwtDecode } from "jwt-decode";
import { setDetectionEstimator } from "@/services/capture/AttributeEstimator";
import { setNearbyAssetSource } from "@/services/capture/NearbyAssets";
import { setPhotoQualityChecker } from "@/services/capture/PhotoQuality";
import { setSpeechToText } from "@/services/capture/SpeechToText";
import { setGnssSource } from "@/services/location/GnssSource";
import { mapAssets$ } from "@/services/storage/AssetStore";
import { captures$, gnssStatus$ } from "@/services/storage/CaptureStore";
import { records$ } from "@/services/storage/RecordStore";
import {
  replaceReviewQueue,
  reviewDecisions$,
  reviewQueue$,
} from "@/services/storage/ReviewStore";
import {
  deviceStatus$,
  replaceDeviceStatus,
} from "@/services/storage/SettingsStore";
import { setCaptureUploader } from "@/services/sync/CaptureSync";
import { accountStore } from "./AccountStore";
import { fakeMapAssets } from "./assets";
import {
  FAKE_CAPTURE_PREFIX,
  FAKE_GNSS,
  fakeCaptureUploader,
  fakeCaptures,
} from "./captures";
import { fakeDetectionEstimator } from "./detections";
import { fakeRecords } from "./records";
import { fakeReviewQueue } from "./reviews";
import { fakeDeviceStatus } from "./settings";
import { fakeGnssSource, fakePhotoQuality } from "./gnss";
import { fakeNearbyAssetSource, fakeSpeechToText } from "./tagging";
import { FAKE_SSO_USER, type FakeUser, REJECTED_PASSWORD } from "./fixtures";
import { FAKE_TOKEN_TTL, fakeClaims, fakeToken } from "./token";
import type { DevMocks } from "./types";

/**
 * Dev-only fake backend for the auth endpoints, seed captures for Home and
 * Records (with their full records for the detail screen) and a fake
 * uploader behind "Sync now", assets for the Map tab, a simulated GNSS
 * receiver and photo-quality check for the capture screen, fake attribute
 * estimates for the detection review, a nearby duplicate and voice input for
 * the tagging form, the supervisor's review queue, and the device status on
 * Settings. The app's real code runs unchanged; only what answers it is
 * fake. Metro swaps this module for mocks/stub.ts unless
 * EXPO_PUBLIC_API_MOCKING=enabled.
 *
 * `scripts/check-release-bundle.sh` fails the build if this marker is bundled.
 */
export const DEV_MOCKS_MARKER = "__IIP_DEV_MOCKS__";
export const FAKE_SSO_CODE = "dev-sso-code";

function tokenResponse(user: FakeUser) {
  const claims = fakeClaims(user);
  return { access_token: fakeToken(claims), expires_in: FAKE_TOKEN_TTL };
}

function body(data: unknown): Record<string, unknown> {
  return typeof data === "string" ? JSON.parse(data) : ((data ?? {}) as never);
}

/** `current` plus the seed rows it lacks (by id); null when none are missing. */
function withMissing<T extends { id: string }>(
  current: readonly T[],
  seed: readonly T[],
): T[] | null {
  const have = new Set(current.map((row) => row.id));
  const missing = seed.filter((row) => !have.has(row.id));
  return missing.length > 0 ? [...current, ...missing] : null;
}

let adapter: MockAdapter | null = null;

export const devMocks: DevMocks = {
  install() {
    if (!__DEV__) {
      throw new Error("Dev mocks must never run in a release build.");
    }
    if (adapter) return;
    console.warn(`${DEV_MOCKS_MARKER} Fake API enabled for auth endpoints.`);

    // Home, Records and Map data. Adds whichever seed rows are missing, so a
    // device that already holds real captures (or data from an older build)
    // still gets the mockups' records, while its own rows stay untouched.
    const captures = withMissing(captures$.get(), fakeCaptures());
    if (captures) captures$.set(captures);
    if (!gnssStatus$.get()) gnssStatus$.set(FAKE_GNSS);
    const assets = withMissing(mapAssets$.get(), fakeMapAssets());
    if (assets) mapAssets$.set(assets);
    // Record detail screens for the fake captures, never for real ones.
    const records = records$.get();
    const missingRecords = fakeRecords(
      captures$.get().filter((c) => c.id.startsWith(FAKE_CAPTURE_PREFIX)),
      mapAssets$.get(),
    ).filter((r) => !records[r.id]);
    if (missingRecords.length > 0) {
      records$.set({
        ...records,
        ...Object.fromEntries(missingRecords.map((r) => [r.id, r])),
      });
    }
    // Review tab: the mockup's queue. An item the supervisor already decided
    // doesn't come back on the next launch.
    const decided = reviewDecisions$.get();
    const queue = withMissing(
      reviewQueue$.get(),
      fakeReviewQueue(captures$.get()).filter((i) => !decided[i.id]),
    );
    if (queue) replaceReviewQueue(queue);
    // Settings: the mockup's model update and storage, until a project is set.
    if (!deviceStatus$.get().project) replaceDeviceStatus(fakeDeviceStatus());
    // Records tab: "Sync now" uploads to nowhere.
    setCaptureUploader(fakeCaptureUploader);

    // Capture screen: converging GPS fixes and passing quality checks.
    setGnssSource(fakeGnssSource);
    setPhotoQualityChecker(fakePhotoQuality);
    // Review screen: attribute estimates, and the mockup's detections when
    // the emulator camera finds none.
    setDetectionEstimator(fakeDetectionEstimator);
    // Tagging form: the mockup's possible duplicate, and dictation that works
    // without a microphone.
    setNearbyAssetSource(fakeNearbyAssetSource);
    setSpeechToText(fakeSpeechToText);

    adapter = new MockAdapter(axiosClient, {
      delayResponse: 400,
      onNoMatch: "passthrough",
    });

    adapter.onPost("/auth/login/password").reply((config) => {
      const { username, password } = body(config.data);
      const user = accountStore.find(username);
      if (!user || !password || password === REJECTED_PASSWORD) {
        return [401, { detail: "Invalid username or password" }];
      }
      if (user.status !== "active") {
        return [
          403,
          { code: "account_pending", detail: "Account awaiting approval" },
        ];
      }
      return [200, tokenResponse(user)];
    });

    adapter.onPost("/auth/register").reply((config) => {
      const { name, email, phone, password } = body(config.data);
      if (![name, email, password].every((v) => typeof v === "string" && v)) {
        return [400, { detail: "Name, email and password are required" }];
      }
      if (accountStore.find(email)) {
        return [409, { detail: "An account with this email already exists" }];
      }
      accountStore.add({
        name: String(name),
        email: String(email),
        phone: typeof phone === "string" ? phone : undefined,
      });
      return [201, { status: "pending_verification" }];
    });

    adapter
      .onPost("/auth/callback")
      .reply((config) =>
        body(config.data).code === FAKE_SSO_CODE
          ? [200, tokenResponse(FAKE_SSO_USER)]
          : [400, { detail: "Invalid authorization code" }],
      );

    adapter.onPost("/auth/refresh").reply((config) => {
      try {
        const { sub } = jwtDecode<Claims>(String(body(config.data).token));
        const user = accountStore.find(sub);
        if (user?.status === "active") return [200, tokenResponse(user)];
      } catch {
        // Fall through: not one of our tokens.
      }
      return [401, { detail: "Invalid token" }];
    });
  },

  async promptSso(request): Promise<AuthSessionResult> {
    const params = { code: FAKE_SSO_CODE, state: request.state };
    return {
      type: "success",
      errorCode: null,
      params,
      authentication: null,
      url: `${request.redirectUri}?code=${FAKE_SSO_CODE}&state=${encodeURIComponent(params.state ?? "")}`,
    };
  },
};
