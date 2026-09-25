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
  deviceStatus$,
  replaceDeviceStatus,
} from "@/services/storage/SettingsStore";
import { onUserDataOpened } from "@/services/storage/UserData";
import { PERMISSIONS, effectivePermissions } from "@/services/auth/Roles";
import { setCaptureUploader } from "@/services/sync/CaptureSync";
import type { Enumerator } from "@/types/Capture";
import type { RejectReason, ReviewOutcome } from "@/types/Review";
import { REVIEW_BATCH_SIZE } from "@/constants/Config";
import {
  MY_REVIEWS_URL,
  REVIEW_BATCH_URL,
  TEAM_RECORDS_URL,
} from "@/services/sync/ReviewSync";
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
import {
  decideOnServer,
  myReviewStatuses,
  nextReviewBatch,
  teamRecords,
} from "./reviewServer";
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

/** Supervisors and admins also capture, just less than the field team. */
const OWN_CAPTURES_FOR_REVIEWERS = 3;

/**
 * Home, Records and record details for the user who just signed in. Adds
 * whichever seed rows are missing, so a user with real captures still gets
 * the mockups' records next to their own. Reviewers get their queue from
 * `GET /review/v1/batch`, like a real server.
 */
function seedUser(user: Enumerator) {
  const reviewer = effectivePermissions(accountStore.find(user.id)).includes(
    PERMISSIONS.REVIEW_DECIDE,
  );
  const seed = fakeCaptures(new Date(), user);
  // A reviewer's own ids differ from the field user's, whose records they
  // download as team records.
  const own = reviewer
    ? seed.slice(0, OWN_CAPTURES_FOR_REVIEWERS).map((c) => ({
        ...c,
        id: c.id.replace(
          FAKE_CAPTURE_PREFIX,
          `${FAKE_CAPTURE_PREFIX}${user.id}-`,
        ),
      }))
    : seed;
  const captures = withMissing(captures$.get(), own);
  if (captures) captures$.set(captures);

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
}

/** The signed-in user a request came from (its bearer token's `sub`). */
function requester(headers: unknown): string | null {
  const auth = (headers as Record<string, unknown> | undefined)?.Authorization;
  const token = typeof auth === "string" ? auth.replace(/^Bearer /, "") : "";
  try {
    return jwtDecode<Claims>(token).sub;
  } catch {
    return null;
  }
}

const canReview = (userId: string | null) =>
  !!userId &&
  effectivePermissions(accountStore.find(userId)).includes(
    PERMISSIONS.REVIEW_DECIDE,
  );

let adapter: MockAdapter | null = null;

export const devMocks: DevMocks = {
  install() {
    if (!__DEV__) {
      throw new Error("Dev mocks must never run in a release build.");
    }
    if (adapter) return;
    console.warn(`${DEV_MOCKS_MARKER} Fake API enabled for auth endpoints.`);

    // Device-wide: the Map's assets and the GNSS state.
    if (!gnssStatus$.get()) gnssStatus$.set(FAKE_GNSS);
    const assets = withMissing(mapAssets$.get(), fakeMapAssets());
    if (assets) mapAssets$.set(assets);
    // Each user's own data, when their database opens at sign-in.
    onUserDataOpened(seedUser);
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

    // Review: batches for supervisors, decisions, and each user's verdicts.
    adapter.onGet(REVIEW_BATCH_URL).reply((config) => {
      if (!canReview(requester(config.headers))) return [403, {}];
      const limit = Number(config.params?.limit) || REVIEW_BATCH_SIZE;
      return [200, nextReviewBatch(limit, mapAssets$.peek())];
    });
    adapter
      .onPatch(/\/observations\/v1\/stream\/[^/]+\/review$/)
      .reply((config) => {
        if (!canReview(requester(config.headers))) return [403, {}];
        const id = decodeURIComponent(
          String(config.url).split("/").slice(-2, -1)[0],
        );
        const { outcome, rejectReason, decidedAt } = body(config.data);
        const accepted = decideOnServer(id, {
          outcome: outcome as ReviewOutcome,
          ...(rejectReason
            ? { rejectReason: rejectReason as RejectReason }
            : {}),
          decidedAt: String(decidedAt ?? new Date().toISOString()),
        });
        return accepted ? [200, {}] : [409, { detail: "Already reviewed" }];
      });
    adapter.onGet(TEAM_RECORDS_URL).reply((config) => {
      if (!canReview(requester(config.headers))) return [403, {}];
      return [200, teamRecords(mapAssets$.peek())];
    });
    adapter.onGet(MY_REVIEWS_URL).reply((config) => {
      const userId = requester(config.headers);
      if (!userId) return [401, {}];
      return [200, myReviewStatuses(userId)];
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
