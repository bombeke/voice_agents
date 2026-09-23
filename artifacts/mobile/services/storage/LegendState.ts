import type { AssetCategory } from "@/constants/Colors";
import type { CaptureFlag, CapturedDetection } from "@/types/Capture";
import { batch, observable } from "@legendapp/state";
import { configureSynced, syncObservable } from "@legendapp/state/sync";
import { syncedQuery } from "@legendapp/state/sync-plugins/tanstack-query";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { AuthType, axiosClient, queryClient } from "../Api";
import type { OpKind, Operation } from "../sync/Types";
import { CAPTURES_STORAGE_KEY, captures$ } from "./CaptureStore";
import type { LocalEventRecord } from "./EventStore";
import {
  deleteCaptureImage,
  persistCaptureImage,
  uploadableImageUri,
} from "./ImageStore";

export const STORAGE_OPS_KEY = "polevision_events_opqueue_v1";

export const STORAGE_EVENTS_KEY = "polevision_events_store_v1";

export const OBSERVATIONS_SYNC_URL = "/observations/v1/stream";

const UPLOAD_TIMEOUT_MS = 60_000;
const REMOTE_REFRESH_MS = 5 * 60_000;
const AUDIT_LOG_LIMIT = 500;
/** 5xx responses are retried this many times before the op is parked in failedOps$. */
const MAX_SERVER_ERROR_ATTEMPTS = 8;

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface PoleTombstone {
  pid: string;
  vc: VectorClock;
  updatedAt: string;
  deviceId: string;
}

export interface IPoleVisionDB {
  poles: LocalPole[];
  /** Locally deleted poles, kept so a pull can't resurrect them before the delete reaches the server. */
  tombstones: Record<string, PoleTombstone>;
  tracks: TrackPoint[];
  agents: any[];
  sanitation: any[];
  roads: any[];
  deviceId: string;
}
export interface RemotePole extends UtilityPole {
  updatedAt?: string;
  deleted?: boolean;
}
export interface SyncMeta {
  updatedAt: string;
  deviceId: string;
  deleted?: boolean;
  syncedAt?: string;
}

export interface UtilityPole {
  id?: string;
  pid?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  imageUri?: string;
  detectionConfidence?: number;
  /** Fault category chosen by the surveyor after the shot, e.g. "leaning". */
  tag?: string;
  /** Free-text note the surveyor added alongside the tag. */
  comment?: string;
  category?: AssetCategory;
  /** Horizontal accuracy (m) of the averaged fix stamped on the record. */
  accuracy?: number;
  /** Degrees from true north at the shutter. */
  heading?: number;
  /** Detector that produced the detection (design-doc §6.4). */
  modelVersion?: string;
  flags?: CaptureFlag[];
  synced: boolean;
  dhis2Id?: string;
  vc: VectorClock;
}

export type SyncedPole = UtilityPole & SyncMeta;

export interface AuditEvent {
  type: string;
  payload: any;
  ts: number;
}
export type VectorClock = Record<string, number>; // deviceId -> counter

export interface CRDTPole extends UtilityPole {
  vc: VectorClock;
  deleted?: boolean;
}

export type SyncedUtilityPole = CRDTPole &
  SyncedPole &
  Partial<CapturedDetection>;

/** Shape of a pole as stored locally; records from older app versions or the server may be partial. */
export type LocalPole = Partial<SyncedUtilityPole>;

export type FailedOperation = Operation & {
  failedAt: string;
  status?: number;
};

let configured = false;

export const poleVisionDB$ = observable<IPoleVisionDB>({
  poles: [],
  tombstones: {},
  tracks: [],
  agents: [],
  sanitation: [],
  roads: [],
  deviceId: "",
});

export const poleVisionDBTracks$ = observable<any>([]);
export const poleVisionDBDeviceId$ = observable<string>("");

export const opQueue$ = observable<Operation[]>([]);
/** Ops the server rejected permanently (4xx). Kept so the capture is never silently lost. */
export const failedOps$ = observable<FailedOperation[]>([]);
export const eventsStore$ = observable<LocalEventRecord[]>([]);
export const auditLog$ = observable<AuditEvent[]>([]);
//@ts-ignore
export const authStore$ = observable<AuthType>({ kind: "basic" });

/** observable for network state */
export const isOnline$ = observable(true);

/**
 * Stable per-install id used as this device's slot in vector clocks.
 * Must only be generated after persistence has loaded, otherwise every launch
 * gets a new id and the clocks grow without bound.
 */
export const getDeviceId = (): string => {
  let id = poleVisionDBDeviceId$.peek();
  if (!id) {
    id = randomUUID();
    poleVisionDBDeviceId$.set(id);
  }
  return id;
};

export function initPersistence() {
  if (configured) return;
  if (Platform.OS === "web") {
    configured = true;
    return;
  }

  const {
    ObservablePersistMMKV,
  } = require("@legendapp/state/persist-plugins/mmkv");
  const syncPlugin = configureSynced({
    persist: {
      plugin: ObservablePersistMMKV,
    },
  });

  syncObservable(
    authStore$,
    syncPlugin({
      persist: {
        name: "polevision_auth_store",
      },
    }),
  );

  syncObservable(
    poleVisionDB$,
    syncPlugin({
      persist: {
        name: "polevision_app_db_v1",
        mmkv: {
          id: "polevision_poles_db",
        },
      },
    }),
  );
  syncObservable(
    poleVisionDBTracks$,
    syncPlugin({
      persist: {
        name: "polevision_tracks",
        mmkv: {
          id: "polevision_tracks_db",
        },
      },
    }),
  );

  syncObservable(
    captures$,
    syncPlugin({
      persist: {
        name: CAPTURES_STORAGE_KEY,
      },
    }),
  );

  syncObservable(
    opQueue$,
    syncPlugin({
      persist: {
        name: STORAGE_OPS_KEY,
      },
    }),
  );

  syncObservable(
    failedOps$,
    syncPlugin({
      persist: {
        name: "polevision_failed_ops_v1",
      },
    }),
  );

  syncObservable(
    eventsStore$,
    syncPlugin({
      persist: {
        name: STORAGE_EVENTS_KEY,
      },
    }),
  );

  syncObservable(
    auditLog$,
    syncPlugin({
      persist: {
        name: "polevision_audit_log_v1",
      },
    }),
  );

  syncObservable(
    poleVisionDBDeviceId$,
    syncPlugin({
      persist: {
        name: "polevision_device_meta",
        mmkv: {
          id: "polevision_device_meta_db",
        },
      },
    }),
  );

  configured = true;

  // MMKV loads synchronously, so persisted values are available from here on.
  getDeviceId();
  repairLegacyState();
}

// --------- Remote (pull) ---------

const fetchRemotePoles = async (): Promise<LocalPole[]> => {
  const res = await axiosClient.get(OBSERVATIONS_SYNC_URL);
  const data = res.data;
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : null;
  // Throw rather than return [] so the query keeps its last good data.
  if (!items) throw new Error("Unexpected observations response");
  return items;
};

export const remotePoles$ = observable(
  syncedQuery<LocalPole[]>({
    queryClient,
    query: {
      queryKey: [OBSERVATIONS_SYNC_URL],
      queryFn: fetchRemotePoles,
      staleTime: 30_000,
      refetchInterval: REMOTE_REFRESH_MS,
    },
  }),
);

export const refreshRemotePoles = () =>
  queryClient.invalidateQueries({ queryKey: [OBSERVATIONS_SYNC_URL] });

// --------- Remote (push) ---------

export const syncPoleToServer = async (
  pole: LocalPole,
  idempotencyKey?: string,
) => {
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(pole));

  if (!pole.deleted) {
    const imageUri = uploadableImageUri(pole.imageUri);
    if (imageUri) {
      formData.append("image", {
        uri: imageUri,
        name: `capture-${pole.pid ?? Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);
    } else if (pole.imageUri) {
      console.warn(`[sync] image for pole ${pole.pid} is missing; uploading metadata only`);
    }
  }

  // The client default is application/json, which makes axios JSON-serialise
  // the FormData and drop the image. multipart/form-data lets RN set the boundary.
  const res = await axiosClient.post(OBSERVATIONS_SYNC_URL, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  console.log("ADDED:",res)

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to sync pole (${res.status})`);
  }

  return res.data;
};

export const getPoleVision = () => {
  return poleVisionDB$.poles.get();
};

// --------- Helper functions ---------

const nowIso = () => new Date().toISOString();

const poleKey = (p?: LocalPole | null): string | undefined =>
  p?.pid ?? p?.id ?? undefined;

const appendAudit = (events: AuditEvent[]) => {
  if (!events.length) return;
  auditLog$.set((prev) => [...(prev ?? []), ...events].slice(-AUDIT_LOG_LIMIT));
};

/** Deletes capture images that no remaining pole points at. */
const releaseImages = (uris: (string | undefined)[]) => {
  const candidates = new Set(uris.filter(Boolean) as string[]);
  if (!candidates.size) return;
  for (const p of poleVisionDB$.poles.peek() ?? []) {
    if (p?.imageUri) candidates.delete(p.imageUri);
  }
  candidates.forEach((uri) => deleteCaptureImage(uri));
};

/**
 * Saves poles locally (offline-first) and queues them for upload.
 * Accepts one pole or a batch (e.g. every detection from one photo).
 */
export const setPoleVision = (
  data: LocalPole | LocalPole[],
): LocalPole[] => {
  const input = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (!input.length) return [];

  const deviceId = getDeviceId();
  const updatedAt = nowIso();
  const existing = new Map<string, LocalPole>();
  for (const p of poleVisionDB$.poles.peek() ?? []) {
    const key = poleKey(p);
    if (key) existing.set(key, p);
  }

  const imageCache = new Map<string, string>();
  const stamped = new Map<string, LocalPole>();
  const kinds = new Map<string, OpKind>();

  for (const pole of input) {
    const pid = poleKey(pole) ?? randomUUID();
    const prev = stamped.get(pid) ?? existing.get(pid);
    stamped.set(pid, {
      ...prev,
      ...pole,
      pid,
      imageUri: persistCaptureImage(pole.imageUri ?? prev?.imageUri, imageCache),
      deleted: false,
      synced: false,
      updatedAt,
      deviceId,
      vc: bumpVC(mergeVC(prev?.vc, pole.vc), deviceId),
    });
    if (!kinds.has(pid)) kinds.set(pid, existing.has(pid) ? "update" : "create");
  }

  const poles = Array.from(stamped.values());

  batch(() => {
    poleVisionDB$.poles.set((prev) => [
      ...(prev ?? []).filter((p) => !stamped.has(poleKey(p) ?? "")),
      ...poles,
    ]);
    poleVisionDB$.tombstones.set((t) => {
      const next = { ...(t ?? {}) };
      stamped.forEach((_, pid) => delete next[pid]);
      return next;
    });
    poles.forEach((p) => enqueuePoleOp(p, kinds.get(p.pid!)));
    appendAudit(
      poles.map((p) => ({ type: "POLE_UPSERT", payload: p, ts: Date.now() })),
    );
  });

  return poles;
};

export const deletePoleVision = (id: string) => {
  const deviceId = getDeviceId();
  const existing = (poleVisionDB$.poles.peek() ?? []).find(
    (p) => poleKey(p) === id,
  );
  const tombstone: PoleTombstone = {
    pid: id,
    vc: bumpVC(existing?.vc, deviceId),
    updatedAt: nowIso(),
    deviceId,
  };
  const deletedPole: LocalPole = { ...tombstone, id: existing?.id, deleted: true };

  batch(() => {
    poleVisionDB$.poles.set((prev) =>
      (prev ?? []).filter((p) => poleKey(p) !== id),
    );
    poleVisionDB$.tombstones.set((t) => ({ ...(t ?? {}), [id]: tombstone }));
    enqueuePoleOp(deletedPole, "delete");
    appendAudit([{ type: "POLE_DELETE", payload: deletedPole, ts: Date.now() }]);
  });

  releaseImages([existing?.imageUri]);
};

export const addTrackPoint = (point: TrackPoint) => {
  poleVisionDB$.tracks.set((prev: TrackPoint[]) => [...prev, point]);
};

export const clearTracks = () => {
  poleVisionDB$.tracks.set([]);
};

export const resolveConflict = (
  local?: SyncedPole,
  remote?: SyncedPole,
): SyncedPole | undefined => {
  if (!local) return remote;
  if (!remote) return local;

  const lt = new Date(local.updatedAt).getTime();
  const rt = new Date(remote.updatedAt).getTime();

  if (lt > rt) return local;
  if (rt > lt) return remote;

  // tie-breaker
  return local.deviceId > remote.deviceId ? local : remote;
};

// --------- Op queue ---------

/** Op currently being uploaded; it can't be cancelled or merged away. */
let inFlightOpId: string | null = null;

/**
 * Queues an upload for a pole. The queue holds at most one op per pole:
 * a newer edit replaces the pending one, and deleting a pole whose create
 * never reached the server drops both.
 */
export const enqueuePoleOp = (pole: LocalPole, kind?: OpKind) => {
  const pid = pole.pid;
  if (!pid) return;
  const deviceId = getDeviceId();
  const opKind: OpKind = kind ?? (pole.deleted ? "delete" : "update");

  opQueue$.set((q) => {
    const queue = q ?? [];
    const rest = queue.filter((o) => o.recordLocalId !== pid);
    const unsentCreate = queue.some(
      (o) =>
        o.recordLocalId === pid &&
        o.kind === "create" &&
        o.opId !== inFlightOpId,
    );

    if (unsentCreate && opKind === "delete") return rest;

    const op: Operation = {
      opId: randomUUID(),
      kind: unsentCreate ? "create" : opKind,
      recordLocalId: pid,
      payload: pole,
      actor: deviceId,
      timestamp: nowIso(),
      attempts: 0,
      // Same version => same key, so a retry after a lost response is deduplicated server-side.
      idempotencyKey: `pole-${pid}-${deviceId}-${pole.vc?.[deviceId] ?? 0}`,
    };
    return [...rest, op];
  });
};

export const upsertPole = (pole: SyncedUtilityPole) => setPoleVision(pole);

export const deletePole = (id: string) => deletePoleVision(id);

type SyncErrorOutcome = "retry" | "done" | "fail";

const classifySyncError = (err: any, op: Operation): SyncErrorOutcome => {
  const status: number | undefined = err?.response?.status;
  if (!status) return "retry"; // offline / timeout
  if (status === 409) return "done"; // server already has this record
  if (op.kind === "delete" && (status === 404 || status === 410)) return "done";
  if ([401, 403, 408, 425, 429].includes(status)) return "retry";
  if (status >= 500) {
    return (op.attempts ?? 0) + 1 >= MAX_SERVER_ERROR_ATTEMPTS ? "fail" : "retry";
  }
  return "fail";
};

const errorMessage = (err: any) =>
  String(err?.response?.data?.message ?? err?.message ?? err);

const onOpSucceeded = (op: Operation) => {
  batch(() => {
    opQueue$.set((q) => (q ?? []).filter((o) => o.opId !== op.opId));
    if (op.kind === "delete") return;

    const sent = op.payload as LocalPole;
    const syncedAt = nowIso();
    poleVisionDB$.poles.set((prev) =>
      (prev ?? []).map((p) =>
        poleKey(p) === op.recordLocalId && compareVersions(p, sent) === "EQUAL"
          ? { ...p, synced: true, syncedAt }
          : p,
      ),
    );
  });
};

const onOpFailed = (op: Operation, err: any, outcome: SyncErrorOutcome) => {
  if (outcome === "fail") {
    batch(() => {
      opQueue$.set((q) => (q ?? []).filter((o) => o.opId !== op.opId));
      failedOps$.set((f) => [
        ...(f ?? []),
        {
          ...op,
          lastError: errorMessage(err),
          failedAt: nowIso(),
          status: err?.response?.status,
        },
      ]);
    });
    console.log("Error:",err)
    console.warn(`[sync] server rejected op ${op.opId} for pole ${op.recordLocalId}`, errorMessage(err));
    return;
  }

  opQueue$.set((q) =>
    (q ?? []).map((o) =>
      o.opId === op.opId
        ? {
            ...o,
            attempts: (o.attempts ?? 0) + 1,
            lastAttemptAt: nowIso(),
            lastError: errorMessage(err),
          }
        : o,
    ),
  );
};

export type ReplayResult = { ok: boolean; pushed: number; failed: number };

let replayPromise: Promise<ReplayResult> | null = null;

const drainOpQueue = async (): Promise<ReplayResult> => {
  let pushed = 0;
  let failed = 0;

  try {
    while (true) {
      const op = (opQueue$.peek() ?? [])[0];
      if (!op) break;

      inFlightOpId = op.opId;
      console.log("Operation:",op)
      try {
        await syncPoleToServer(op.payload as LocalPole, op.idempotencyKey);
        onOpSucceeded(op);
        pushed++;
      } 
      catch (err) {
        const outcome = classifySyncError(err, op);
        if (outcome === "done") {
          onOpSucceeded(op);
          pushed++;
          continue;
        }
        onOpFailed(op, err, outcome);
        if (outcome === "retry") return { ok: false, pushed, failed };
        failed++;
      } finally {
        inFlightOpId = null;
      }
    }
    return { ok: true, pushed, failed };
  } finally {
    // Pull the server's view (and other devices' captures) once our writes are in.
    if (pushed > 0) refreshRemotePoles();
  }
};

/**
 * Uploads queued ops in order. Concurrent callers share the same run.
 * Stops at the first retryable failure (usually offline) and leaves the rest queued.
 */
export const replayOpQueue = (): Promise<ReplayResult> => {
  if (!replayPromise) {
    replayPromise = drainOpQueue().finally(() => {
      replayPromise = null;
    });
  }
  return replayPromise;
};

/** Moves ops the server rejected back onto the queue (e.g. after a server fix). */
export const retryFailedOps = () => {
  const failed = failedOps$.peek() ?? [];
  if (!failed.length) return;
  const pending = new Set((opQueue$.peek() ?? []).map((o) => o.recordLocalId));
  batch(() => {
    failedOps$.set([]);
    // A newer queued edit of the same pole supersedes the failed one.
    failed
      .filter((op) => !pending.has(op.recordLocalId))
      .forEach((op) => enqueuePoleOp(op.payload as LocalPole, op.kind));
  });
};

// --------- Merge remote into local ---------

const parseClock = (value: unknown): VectorClock => {
  let vc = value;
  if (typeof vc === "string") {
    try {
      vc = JSON.parse(vc);
    } catch {
      return {};
    }
  }
  if (!vc || typeof vc !== "object") return {};
  const out: VectorClock = {};
  for (const [k, v] of Object.entries(vc)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
};

const normalizeRemotePole = (raw: any): LocalPole | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const pid = raw.pid ?? raw.id;
  if (pid == null) return undefined;

  const pole: LocalPole = {
    ...raw,
    pid: String(pid),
    vc: parseClock(raw.vc),
    deleted: raw.deleted === true || raw.deleted === "true",
  };
  for (const k of ["latitude", "longitude", "timestamp"] as const) {
    if (raw[k] != null) pole[k] = Number(raw[k]);
  }
  // A live record we can't place on the map is of no use to the dashboard.
  if (
    !pole.deleted &&
    !(Number.isFinite(pole.latitude) && Number.isFinite(pole.longitude))
  ) {
    return undefined;
  }
  return pole;
};

/**
 * Merges the server's poles into the local store (which the dashboard reads).
 *  - pid is the identity, so the same capture never appears twice
 *  - conflicts are resolved with vector clocks, falling back to updatedAt
 *  - local edits/deletes that haven't been uploaded yet are not overwritten
 */
export const mergeRemotePoles = (remoteRaw: unknown[]) => {
  const remote = remoteRaw
    .map(normalizeRemotePole)
    .filter((p): p is LocalPole => !!p);

  const deviceId = getDeviceId();
  const pending = new Set((opQueue$.peek() ?? []).map((o) => o.recordLocalId));
  const tombstones = { ...(poleVisionDB$.tombstones.peek() ?? {}) };
  const current = poleVisionDB$.poles.peek() ?? [];

  const next = new Map<string, LocalPole>();
  for (const p of current) {
    const key = poleKey(p);
    if (key) next.set(key, p);
  }

  const liveRemote = new Set<string>();
  const cancelOps = new Set<string>();
  const toPush: LocalPole[] = [];
  const removedImages: (string | undefined)[] = [];

  for (const rp of remote) {
    const pid = rp.pid!;
    if (!rp.deleted) liveRemote.add(pid);

    const tomb = tombstones[pid];
    if (tomb) {
      // Deleted here: only an edit made after seeing our delete brings it back.
      if (rp.deleted || compareVersions(rp, tomb) !== "AFTER") continue;
      delete tombstones[pid];
      cancelOps.add(pid);
    }

    const lp = next.get(pid);
    const rel = lp ? compareVersions(lp, rp) : "BEFORE";
    const merged = resolveCRDTPole(lp as CRDTPole | undefined, rp as CRDTPole);
    if (!merged) continue;

    if (merged.deleted) {
      if (lp) removedImages.push(lp.imageUri);
      next.delete(pid);
      cancelOps.add(pid);
      continue;
    }

    // Keep our local image file; the server copy may be another device's path.
    let result: LocalPole = { ...merged, imageUri: lp?.imageUri ?? merged.imageUri };

    if (rel === "BEFORE") {
      // The server already has a newer version; a queued older one must not overwrite it.
      cancelOps.add(pid);
      result.synced = true;
    } else if (rel === "CONCURRENT" && hasClock(lp?.vc) && hasClock(rp.vc)) {
      // Both sides changed: keep the merge and push it so the server converges too.
      result = {
        ...result,
        updatedAt: nowIso(),
        deviceId,
        vc: bumpVC(result.vc, deviceId),
        synced: false,
      };
      toPush.push(result);
    } else {
      const hasPending = pending.has(pid) && !cancelOps.has(pid);
      result.synced = !hasPending && (rel === "EQUAL" || lp?.synced === true);
    }

    next.set(pid, result);
  }

  // Drop tombstones once the delete is uploaded and the server no longer lists the pole.
  for (const pid of Object.keys(tombstones)) {
    if (!pending.has(pid) && !liveRemote.has(pid)) delete tombstones[pid];
  }

  batch(() => {
    poleVisionDB$.poles.set(Array.from(next.values()));
    poleVisionDB$.tombstones.set(tombstones);
    if (cancelOps.size) {
      opQueue$.set((q) =>
        (q ?? []).filter(
          (o) => !cancelOps.has(o.recordLocalId) || o.opId === inFlightOpId,
        ),
      );
    }
    toPush.forEach((p) => enqueuePoleOp(p, "update"));
  });

  releaseImages(removedImages);
};

// --------- Legacy data repair ---------

/**
 * Earlier versions of setPoleVision spread the whole input array into a single
 * record (`{ 0: pole, 1: pole, ... }`) with no pid, and queued an op per edit.
 * Recover those captures and collapse the queue to one op per pole.
 */
function repairLegacyState() {
  if (poleVisionDB$.tombstones.peek() == null) poleVisionDB$.tombstones.set({});

  const poles = poleVisionDB$.poles.peek() ?? [];
  const valid: LocalPole[] = [];
  const recovered = new Map<string, LocalPole>();
  for (const p of poles) {
    if (poleKey(p)) {
      valid.push(p);
      continue;
    }
    for (const [k, v] of Object.entries(p ?? {})) {
      if (/^\d+$/.test(k) && v && typeof v === "object" && (v as LocalPole).pid) {
        recovered.set((v as LocalPole).pid!, v as LocalPole);
      }
    }
  }

  const ops = opQueue$.peek() ?? [];
  const keptOps = new Map<string, Operation>();
  for (const op of ops) {
    const payload = op.payload as LocalPole | undefined;
    const isPoleOp = !!payload && ("pid" in payload || "vc" in payload);
    if (!isPoleOp) {
      keptOps.set(op.opId, op); // not ours (e.g. DHIS2 event ops)
    } else if (payload.pid && payload.pid === op.recordLocalId) {
      keptOps.delete(`pole:${payload.pid}`);
      keptOps.set(`pole:${payload.pid}`, op); // latest op per pole wins
    }
    // else: corrupted pole payload with no pid — dropped, recovered below
  }

  const validIds = new Set(valid.map(poleKey));
  const toRecover = Array.from(recovered.values()).filter((p) => !validIds.has(p.pid));

  batch(() => {
    if (valid.length !== poles.length) poleVisionDB$.poles.set(valid);
    if (keptOps.size !== ops.length) opQueue$.set(Array.from(keptOps.values()));

    // Audit entries used to be written into eventsStore$ (the DHIS2 event store).
    const events = eventsStore$.peek() ?? [];
    const cleaned = events.filter(
      (e: any) => !(e && !e.localId && (e.type === "POLE_UPSERT" || e.type === "POLE_DELETE")),
    );
    if (cleaned.length !== events.length) eventsStore$.set(cleaned);
  });

  if (toRecover.length) {
    console.log(`[sync] recovered ${toRecover.length} poles from corrupted records`);
    setPoleVision(toRecover);
  }
}

// --------- Vector clocks ---------

const hasClock = (vc?: VectorClock | null) => !!vc && Object.keys(vc).length > 0;

const updatedAtMs = (p?: { updatedAt?: string }) => {
  const t = p?.updatedAt ? Date.parse(p.updatedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** Compares two versions of a record; uses vector clocks when both have one, else updatedAt. */
export const compareVersions = (
  a: { vc?: VectorClock; updatedAt?: string },
  b: { vc?: VectorClock; updatedAt?: string },
): VCRelation => {
  if (hasClock(a.vc) && hasClock(b.vc)) return compareVC(a.vc, b.vc);
  const at = updatedAtMs(a);
  const bt = updatedAtMs(b);
  if (at > bt) return "AFTER";
  if (at < bt) return "BEFORE";
  return "EQUAL";
};

export const bumpVC = (vc: VectorClock | undefined, deviceId: string): VectorClock => {
  return {
    ...vc,
    [deviceId]: (vc?.[deviceId] ?? 0) + 1,
  };
};

export type VCRelation = "BEFORE" | "AFTER" | "CONCURRENT" | "EQUAL";

export const compareVC = (a: VectorClock = {}, b: VectorClock = {}): VCRelation => {
  let gt = false,
    lt = false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    if (av > bv) gt = true;
    if (av < bv) lt = true;
  }

  if (gt && lt) return "CONCURRENT";
  if (gt) return "AFTER";
  if (lt) return "BEFORE";
  return "EQUAL";
};

export const mergeConcurrent = (a: CRDTPole, b: CRDTPole): CRDTPole => {
  return {
    ...a,
    ...b,
    // deterministic tie-break
    //name: a.name > b.name ? a.name : b.name,
    //height: Math.max(a.height ?? 0, b.height ?? 0),
    vc: mergeVC(a.vc, b.vc),
    deleted: a.deleted || b.deleted,
  };
};

export const mergeVC = (a: VectorClock = {}, b: VectorClock = {}): VectorClock => {
  const merged: VectorClock = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const k of keys) {
    merged[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }

  return merged;
};

export const resolveCRDTPole = (
  local?: CRDTPole,
  remote?: CRDTPole,
): CRDTPole | undefined => {
  if (!local) return remote;
  if (!remote) return local;

  const rel = compareVersions(local, remote);

  if (rel === "AFTER") return local;
  if (rel === "BEFORE") return remote;
  // Same version: keep local values, pick up fields only the server has (ids, URLs, ...)
  if (rel === "EQUAL") return { ...remote, ...local };

  // CONCURRENT
  return mergeConcurrent(local, remote);
};
