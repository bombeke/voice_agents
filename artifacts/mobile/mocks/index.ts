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
import { setCaptureUploader } from "@/services/sync/CaptureSync";
import { accountStore } from "./AccountStore";
import { fakeMapAssets } from "./assets";
import { FAKE_GNSS, fakeCaptureUploader, fakeCaptures } from "./captures";
import { fakeDetectionEstimator } from "./detections";
import { fakeGnssSource, fakePhotoQuality } from "./gnss";
import { fakeNearbyAssetSource, fakeSpeechToText } from "./tagging";
import { FAKE_SSO_USER, type FakeUser, REJECTED_PASSWORD } from "./fixtures";
import { FAKE_TOKEN_TTL, fakeClaims, fakeToken } from "./token";
import type { DevMocks } from "./types";

/**
 * Dev-only fake backend for the auth endpoints, seed captures for Home and
 * Records with a fake uploader behind "Sync now", assets for the Map tab, a simulated GNSS receiver and photo-quality check
 * for the capture screen,
 * fake attribute estimates for the detection review, and a nearby duplicate
 * and voice input for the tagging form. The app's real code runs
 * unchanged; only what answers it is fake. Metro swaps this module for
 * mocks/stub.ts unless EXPO_PUBLIC_API_MOCKING=enabled.
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

let adapter: MockAdapter | null = null;

export const devMocks: DevMocks = {
  install() {
    if (!__DEV__) {
      throw new Error("Dev mocks must never run in a release build.");
    }
    if (adapter) return;
    console.warn(`${DEV_MOCKS_MARKER} Fake API enabled for auth endpoints.`);

    // Home screen data. Only fills an empty store so real captures survive.
    if (captures$.get().length === 0) captures$.set(fakeCaptures());
    if (!gnssStatus$.get()) gnssStatus$.set(FAKE_GNSS);
    // Map tab pins and asset profiles, likewise only into an empty store.
    if (mapAssets$.get().length === 0) mapAssets$.set(fakeMapAssets());
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
