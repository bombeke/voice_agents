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
import { getDb } from "@/db/Current";
import {
  captures as capturesTable,
  mapAssets as mapAssetsTable,
  observations as observationsTable,
  syncState as syncStateTable,
} from "@/db/schema";
import { OBSERVATIONS_COLLECTION } from "@/services/sync/PullSync";
import { eq, like, or } from "drizzle-orm";
import { gnssStatus$ } from "@/services/storage/CaptureStore";
import { captureRow } from "@/services/storage/repos/CaptureRepo";
import { upsertAssets } from "@/services/storage/repos/MapAssetRepo";
import {
  deviceStatus$,
  replaceDeviceStatus,
} from "@/services/storage/SettingsStore";
import { currentUser$, onUserDataOpened } from "@/services/storage/UserData";
import { PERMISSIONS, effectivePermissions } from "@/services/auth/Roles";
import {
  OBSERVATIONS_CHANGES_URL,
  OBSERVATIONS_PUSH_URL,
  UPLOADS_URL,
} from "@/services/sync/Endpoints";
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
import { FAKE_CAPTURE_PREFIX, FAKE_GNSS, fakeCaptures } from "./captures";
import { fakeDetectionEstimator } from "./detections";
import { fakeRecords } from "./records";
import {
  decideOnServer,
  myReviewStatuses,
  nextReviewBatch,
  teamRecords,
} from "./reviewServer";
import { fakeDeviceStatus } from "./settings";
import { DbBenchView } from "./bench/DbBenchView";
import { fakeGnssSource, fakePhotoQuality } from "./gnss";
import {
  bodyLength,
  changesAfter,
  completeUpload,
  metadataOf,
  pushObservation,
  putChunk,
  rangeStart,
  resetSyncServer,
  seedRemoteObservations,
  startUpload,
  uploadStatus,
} from "./syncServer";
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

/** Supervisors and admins also capture, just less than the field team. */
const OWN_CAPTURES_FOR_REVIEWERS = 3;

/**
 * Home, Records, record details and the Map for the user who just signed
 * in, written to their database. Adds whichever seed rows are missing (by
 * id), so a user with real captures still gets the mockups' records next to
 * their own. Reviewers get their queue from `GET /review/v1/batch`, like a
 * real server.
 */
async function seedUser(user: Enumerator) {
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
  const assets = fakeMapAssets();
  const records = fakeRecords(own, assets);
  const summaries = new Map(own.map((c) => [c.id, c]));
  const now = Date.now();
  // Record detail screens for the fake captures (and the earlier
  // inspection of EP-00412 in their history), never for real ones.
  const rows = records.map((record) =>
    captureRow(
      summaries.get(record.id) ?? {
        id: record.id,
        category: record.category,
        title: record.title,
        ...(record.assetId ? { assetId: record.assetId } : {}),
        capturedAt: record.capturedAt,
        accuracyM: record.location.accuracy ?? 0,
        syncStatus: "synced",
        flagged: false,
        ...(record.capturedBy ? { capturedBy: record.capturedBy } : {}),
      },
      record,
      "mine",
      now,
    ),
  );
  await getDb().write(async (tx) => {
    const [anyAsset] = await tx
      .select({ id: mapAssetsTable.id })
      .from(mapAssetsTable)
      .limit(1);
    if (!anyAsset) await upsertAssets(tx, assets);
    for (let i = 0; i < rows.length; i += 100) {
      await tx
        .insert(capturesTable)
        .values(rows.slice(i, i + 100))
        .onConflictDoNothing();
    }
  });
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
  BenchView: DbBenchView,

  async reseed() {
    const user = currentUser$.peek();
    if (!user) throw new Error("Sign in first: the mock data is per user.");
    // Only what the seed and the fake server made; the user's own captures stay.
    await getDb().write(async (tx) => {
      await tx
        .delete(capturesTable)
        .where(
          or(
            like(capturesTable.id, `${FAKE_CAPTURE_PREFIX}%`),
            like(capturesTable.id, "fake-record-%"),
          ),
        );
      await tx.delete(mapAssetsTable);
      await tx
        .delete(observationsTable)
        .where(like(observationsTable.pid, "srv-%"));
      // Pull the fresh fake server from the start.
      await tx
        .delete(syncStateTable)
        .where(eq(syncStateTable.collection, OBSERVATIONS_COLLECTION));
    });
    resetSyncServer();
    seedRemoteObservations(fakeMapAssets());
    await seedUser(user);
  },

  install() {
    if (!__DEV__) {
      throw new Error("Dev mocks must never run in a release build.");
    }
    if (adapter) return;
    console.warn(`${DEV_MOCKS_MARKER} Fake API enabled for auth endpoints.`);

    // Device-wide: the GNSS state.
    if (!gnssStatus$.get()) gnssStatus$.set(FAKE_GNSS);
    // Each user's own data and the Map's assets, when their database opens.
    onUserDataOpened(seedUser);
    // Other enumerators' observations for the first delta pull to bring down.
    seedRemoteObservations(fakeMapAssets());
    // Settings: the mockup's model update and storage, until a project is set.
    if (!deviceStatus$.get().project) replaceDeviceStatus(fakeDeviceStatus());

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
      return [200, nextReviewBatch(limit, fakeMapAssets())];
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
      return [200, teamRecords(fakeMapAssets())];
    });
    adapter.onGet(MY_REVIEWS_URL).reply((config) => {
      const userId = requester(config.headers);
      if (!userId) return [401, {}];
      return [200, myReviewStatuses(userId)];
    });

    // Sync: delta pull, idempotent push, resumable chunked photo uploads.
    adapter.onGet(OBSERVATIONS_CHANGES_URL).reply((config) => {
      if (!requester(config.headers)) return [401, {}];
      const cursor = config.params?.cursor
        ? String(config.params.cursor)
        : null;
      return [200, changesAfter(cursor, Number(config.params?.limit) || 500)];
    });
    adapter.onPost(OBSERVATIONS_PUSH_URL).reply((config) => {
      if (!requester(config.headers)) return [401, {}];
      const key = (config.headers as Record<string, unknown> | undefined)?.[
        "Idempotency-Key"
      ];
      return [
        pushObservation(metadataOf(config.data), key ? String(key) : undefined),
        {},
      ];
    });
    adapter.onPost(UPLOADS_URL).reply((config) => {
      const { entityId, sha256, byteSize } = body(config.data);
      return [
        200,
        startUpload({
          entityId: String(entityId),
          sha256: String(sha256),
          byteSize: Number(byteSize),
        }),
      ];
    });
    const uploadId = (url?: string) =>
      decodeURIComponent(
        String(url).split(`${UPLOADS_URL}/`)[1]?.split("/")[0] ?? "",
      );
    adapter.onGet(new RegExp(`${UPLOADS_URL}/[^/]+$`)).reply((config) => {
      const status = uploadStatus(uploadId(config.url));
      return status ? [200, status] : [404, {}];
    });
    adapter
      .onPut(new RegExp(`${UPLOADS_URL}/[^/]+/chunks$`))
      .reply((config) => {
        const headers = config.headers as Record<string, unknown> | undefined;
        const { status, offset } = putChunk(
          uploadId(config.url),
          rangeStart(headers?.["Content-Range"]),
          bodyLength(config.data),
        );
        return [status, { offset }];
      });
    adapter
      .onPost(new RegExp(`${UPLOADS_URL}/[^/]+/complete$`))
      .reply((config) => {
        const { status, url } = completeUpload(
          uploadId(config.url),
          String(body(config.data).sha256),
        );
        return [status, url ? { url } : {}];
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
