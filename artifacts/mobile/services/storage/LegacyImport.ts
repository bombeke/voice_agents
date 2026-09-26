import type { Database, Orm } from "@/db/Database";
import {
  attachments,
  auditLog,
  dhis2Events,
  outbox,
  reviewDecisions,
  reviewItems,
  reviewStatus,
  syncState,
  trackPoints,
} from "@/db/schema";
import { updatedAtMs, type Versioned } from "@/services/sync/ConflictResolver";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import type { MapAsset } from "@/types/Map";
import type { LocalPole } from "@/types/Observation";
import type {
  MyReviewStatus,
  ReviewBatch,
  ReviewDecision,
  ReviewItem,
  TeamRecord,
} from "@/types/Review";
import { eq } from "drizzle-orm";
import {
  captureRow,
  upsertOwnCaptures,
  upsertTeamRecords,
} from "./repos/CaptureRepo";
import { upsertAssets } from "./repos/MapAssetRepo";
import { rowFromPole, upsertObservationRows } from "./repos/ObservationRepo";
import { REVIEW_BATCH_COLLECTION } from "./repos/ReviewRepo";

/** The keys builds before SQLite kept each store under, in the user's MMKV. */
export const LEGACY_KEYS = {
  captures: "iip_captures_v1",
  records: "iip_records_v1",
  reviewQueue: "iip_review_queue_v1",
  reviewDecisions: "iip_review_decisions_v1",
  reviewBatch: "iip_review_batch_v1",
  teamRecords: "iip_team_records_v1",
  myReviews: "iip_my_reviews_v1",
  opQueue: "polevision_events_opqueue_v1",
  failedOps: "polevision_failed_ops_v1",
  events: "polevision_events_store_v1",
  auditLog: "polevision_audit_log_v1",
  poles: "polevision_app_db_v1",
  tracks: "polevision_tracks",
} as const;

/** Device-wide (all users): the map's asset cache. Read, never removed. */
export const LEGACY_DEVICE_KEYS = { mapAssets: "iip_map_assets_v1" } as const;

export const IMPORT_MARKER = "legacy_import_v1";

/** A key-value store the blobs are read from: MMKV on the device, a Map in tests. */
export interface LegacySource {
  getString(key: string): string | undefined;
  remove(key: string): void;
}

interface LegacyOp {
  opId: string;
  kind: "create" | "update" | "delete";
  recordLocalId: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
  attempts?: number;
  idempotencyKey?: string;
  lastError?: string;
  status?: number;
}

interface LegacyPoleDB {
  poles?: LocalPole[];
  tombstones?: Record<
    string,
    {
      pid: string;
      vc: Record<string, number>;
      updatedAt: string;
      deviceId: string;
    }
  >;
  tracks?: { lat: number; lng: number; timestamp?: number }[];
}

export interface ImportSummary {
  /** False when an earlier run had already imported (keys were only cleaned up). */
  imported: boolean;
  counts: Record<string, number>;
}

const parse = <T>(raw: string | undefined): T | undefined => {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const arrayOf = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const valuesOf = <T>(v: unknown): T[] =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (Object.values(v) as T[])
    : arrayOf<T>(v);

const poleKey = (p?: LocalPole | null) => p?.pid ?? p?.id ?? undefined;

/** Pole payloads from app versions that spread a batch into one record (`{0: pole, 1: pole}`). */
function recoverPoles(poles: LocalPole[]): LocalPole[] {
  const out = new Map<string, LocalPole>();
  for (const p of poles) {
    const key = poleKey(p);
    if (key) {
      out.set(key, { ...p, pid: key });
      continue;
    }
    for (const [k, v] of Object.entries(p ?? {})) {
      const nested = v as LocalPole;
      if (
        /^\d+$/.test(k) &&
        nested &&
        typeof nested === "object" &&
        nested.pid &&
        !out.has(nested.pid)
      ) {
        out.set(nested.pid, nested);
      }
    }
  }
  return [...out.values()];
}

/** A key and the metadata key Legend's persist plugin kept beside it. */
const removeKey = (source: LegacySource, key: string) => {
  source.remove(key);
  source.remove(`${key}__m`);
};

const isLocalFile = (uri?: string) => !!uri && !/^https?:\/\//i.test(uri);

async function isMarked(orm: Orm) {
  const [row] = await orm
    .select({ at: syncState.lastSyncedAt })
    .from(syncState)
    .where(eq(syncState.collection, IMPORT_MARKER));
  return !!row;
}

/**
 * One-time move of the Legend-State/MMKV blobs into SQLite.
 *
 * - Everything is written in ONE transaction together with a marker row. A
 *   crash before COMMIT leaves no trace, and the next sign-in simply runs it
 *   again; the source keys are still there.
 * - The source keys are removed only after the commit. A crash between the
 *   two finds the marker next time: nothing is imported twice (which could
 *   overwrite edits made since), the leftover keys are just removed.
 * - Rows are keyed by the records' own ids and outbox rows by their
 *   idempotency keys, so even a forced re-run can't duplicate anything.
 */
export async function importLegacyData(
  db: Database,
  user: LegacySource,
  device: LegacySource | null,
  { now = Date.now(), deviceId }: { now?: number; deviceId: string },
): Promise<ImportSummary> {
  const userKeys = Object.values(LEGACY_KEYS);
  if (await isMarked(db.orm)) {
    userKeys.forEach((k) => removeKey(user, k));
    return { imported: false, counts: {} };
  }

  const read = <T>(key: string) => parse<T>(user.getString(key));
  const captureList = arrayOf<CaptureSummary>(read(LEGACY_KEYS.captures));
  const records =
    read<Record<string, CaptureRecord>>(LEGACY_KEYS.records) ?? {};
  const poleDb = read<LegacyPoleDB>(LEGACY_KEYS.poles) ?? {};
  const ops = arrayOf<LegacyOp>(read(LEGACY_KEYS.opQueue));
  const failedOps = arrayOf<LegacyOp>(read(LEGACY_KEYS.failedOps));
  const decisions = valuesOf<ReviewDecision>(read(LEGACY_KEYS.reviewDecisions));
  const queue = arrayOf<ReviewItem>(read(LEGACY_KEYS.reviewQueue));
  const batch = read<ReviewBatch | null>(LEGACY_KEYS.reviewBatch) ?? null;
  const team = valuesOf<TeamRecord>(read(LEGACY_KEYS.teamRecords));
  const verdicts = valuesOf<MyReviewStatus>(read(LEGACY_KEYS.myReviews));
  const events = arrayOf<Record<string, unknown>>(read(LEGACY_KEYS.events));
  const audit = arrayOf<{ type: string; payload: unknown; ts: number }>(
    read(LEGACY_KEYS.auditLog),
  );
  const tracks = [
    ...arrayOf<{ lat: number; lng: number; timestamp?: number }>(poleDb.tracks),
    ...arrayOf<{ lat: number; lng: number; timestamp?: number }>(
      read(LEGACY_KEYS.tracks),
    ),
  ];
  const assets = device
    ? arrayOf<MapAsset>(parse(device.getString(LEGACY_DEVICE_KEYS.mapAssets)))
    : [];

  // Which capture each pole belongs to: records list their poles; a
  // capture's id is also its first pole's pid.
  const captureOfPole = new Map<string, string>();
  for (const r of Object.values(records)) {
    for (const pid of r?.poleIds ?? []) captureOfPole.set(pid, r.id);
  }
  captureList.forEach((c) =>
    captureOfPole.set(c.id, captureOfPole.get(c.id) ?? c.id),
  );

  const poleOps = new Map<string, LegacyOp>();
  const isPoleOp = (op: LegacyOp) =>
    !!op.payload && ("pid" in op.payload || "vc" in op.payload);
  for (const op of ops) if (isPoleOp(op)) poleOps.set(op.recordLocalId, op); // latest wins
  const refused = new Map<string, LegacyOp>();
  for (const op of failedOps)
    if (isPoleOp(op) && !poleOps.has(op.recordLocalId))
      refused.set(op.recordLocalId, op);

  const counts: Record<string, number> = {};

  await db.write(async (tx) => {
    // Observations: live poles, then tombstones not overridden by a live pole.
    const poles = recoverPoles(arrayOf<LocalPole>(poleDb.poles));
    const livePids = new Set(poles.map((p) => p.pid!));
    const tombstones = Object.values(poleDb.tombstones ?? {}).filter(
      (t) => !livePids.has(t.pid),
    );
    const obsRows = [
      ...poles.map((p) => {
        const pending = poleOps.has(p.pid!) || refused.has(p.pid!);
        const pole = {
          ...p,
          pid: p.pid!,
          vc: p.vc ?? {},
          synced: !pending && p.synced !== false,
        } as Versioned & LocalPole;
        return rowFromPole(pole, captureOfPole.get(p.pid!) ?? null, now);
      }),
      ...tombstones.map((t) =>
        rowFromPole(
          { ...t, deleted: true, synced: !poleOps.has(t.pid) } as Versioned &
            LocalPole,
          captureOfPole.get(t.pid) ?? null,
          now,
        ),
      ),
    ];
    for (let i = 0; i < obsRows.length; i += 200) {
      await upsertObservationRows(tx, obsRows.slice(i, i + 200));
    }
    counts.observations = obsRows.length;

    // Outbox: queued pole uploads keep their keys; refused ones stay refused.
    const outboxRows = [...poleOps.values(), ...refused.values()].map((op) => ({
      id: op.opId,
      entity: "observation" as const,
      entityId: op.recordLocalId,
      op: op.kind === "create" ? ("insert" as const) : op.kind,
      payload: op.payload ?? {},
      idempotencyKey: op.idempotencyKey ?? `legacy-${op.opId}`,
      createdAt: Date.parse(op.timestamp ?? "") || now,
      attemptCount: op.attempts ?? 0,
      nextAttemptAt: now,
      lastError: op.lastError ?? null,
      state: refused.has(op.recordLocalId)
        ? ("failed" as const)
        : ("pending" as const),
      lastStatus: op.status ?? null,
    }));
    // Decisions the server hasn't confirmed: the old code sent them from the store.
    const unsentDecisions = decisions.filter(
      (d) => d?.itemId && d.syncStatus !== "synced",
    );
    for (const d of unsentDecisions) {
      outboxRows.push({
        id: `legacy-review-${d.itemId}`,
        entity: "review_decision" as never,
        entityId: d.itemId,
        op: "insert",
        payload: { ...d, syncStatus: "pending" },
        idempotencyKey: `review-${d.itemId}`,
        createdAt: Date.parse(d.decidedAt) || now,
        attemptCount: 0,
        nextAttemptAt: now,
        lastError: null,
        state: d.syncStatus === "failed" ? "failed" : "pending",
        lastStatus: null,
      });
    }
    for (let i = 0; i < outboxRows.length; i += 200) {
      await tx
        .insert(outbox)
        .values(outboxRows.slice(i, i + 200))
        .onConflictDoNothing();
    }
    counts.outbox = outboxRows.length;

    // Photos of records not yet uploaded (the old upload sent them inline).
    const photoRows = poles
      .filter(
        (p) =>
          (poleOps.has(p.pid!) || refused.has(p.pid!)) &&
          isLocalFile(p.imageUri),
      )
      .map((p) => ({
        id: `legacy-photo-${p.pid}`,
        entityId: p.pid!,
        localPath: p.imageUri!,
        createdAt: now,
      }));
    for (let i = 0; i < photoRows.length; i += 200) {
      await tx
        .insert(attachments)
        .values(photoRows.slice(i, i + 200))
        .onConflictDoNothing();
    }
    counts.attachments = photoRows.length;

    // Captures: a run cut off mid-upload left rows "uploading".
    await upsertOwnCaptures(
      tx,
      captureList
        .filter((c) => c?.id)
        .map((c) => {
          const summary: CaptureSummary = {
            ...c,
            syncStatus: c.syncStatus === "uploading" ? "pending" : c.syncStatus,
          };
          return captureRow(summary, records[c.id] ?? null, "mine", now);
        }),
    );
    counts.captures = captureList.length;
    await upsertTeamRecords(
      tx,
      team.filter((t) => t?.summary?.id),
      now,
    );
    counts.teamRecords = team.length;

    // Review.
    const decided = new Set(decisions.map((d) => d.itemId));
    const items = queue.filter((i) => i?.id && !decided.has(i.id));
    for (let i = 0; i < items.length; i += 200) {
      await tx
        .insert(reviewItems)
        .values(
          items.slice(i, i + 200).map((item) => ({
            id: item.id,
            captureId: item.captureId ?? null,
            reasonKind: item.reason?.kind ?? "low_confidence",
            capturedAt: Date.parse(item.capturedAt) || 0,
            data: item,
          })),
        )
        .onConflictDoNothing();
    }
    counts.reviewItems = items.length;
    for (const d of decisions.filter((d) => d?.itemId)) {
      await tx
        .insert(reviewDecisions)
        .values({
          itemId: d.itemId,
          captureId: d.captureId ?? null,
          outcome: d.outcome,
          rejectReason: d.rejectReason ?? null,
          decidedAt: Date.parse(d.decidedAt) || now,
          syncStatus: d.syncStatus === "uploading" ? "pending" : d.syncStatus,
        })
        .onConflictDoNothing();
    }
    counts.reviewDecisions = decisions.length;
    for (const v of verdicts.filter((v) => v?.captureId)) {
      await tx
        .insert(reviewStatus)
        .values({ captureId: v.captureId, state: v.state, data: v })
        .onConflictDoNothing();
    }
    counts.reviewStatus = verdicts.length;
    if (batch) {
      await tx
        .insert(syncState)
        .values({
          collection: REVIEW_BATCH_COLLECTION,
          lastSyncedAt: Date.parse(batch.downloadedAt) || now,
          meta: { ...batch },
        })
        .onConflictDoNothing();
    }

    // The rest: map cache, tracks, DHIS2 events, audit trail.
    await upsertAssets(
      tx,
      assets.filter((a) => a?.id),
    );
    counts.mapAssets = assets.length;
    const points = tracks.filter(
      (t) => Number.isFinite(t?.lat) && Number.isFinite(t?.lng),
    );
    for (let i = 0; i < points.length; i += 500) {
      await tx.insert(trackPoints).values(
        points.slice(i, i + 500).map((t) => ({
          lat: t.lat,
          lng: t.lng,
          timestamp: t.timestamp ?? now,
        })),
      );
    }
    counts.trackPoints = points.length;
    const eventRows = events.filter((e) => e && typeof e.localId === "string");
    for (const e of eventRows) {
      await tx
        .insert(dhis2Events)
        .values({
          localId: e.localId as string,
          updatedAt: updatedAtMs(e.meta as never) || now,
          data: e,
        })
        .onConflictDoNothing();
    }
    counts.dhis2Events = eventRows.length;
    const trail = audit.slice(-500);
    for (let i = 0; i < trail.length; i += 200) {
      await tx.insert(auditLog).values(
        trail.slice(i, i + 200).map((a) => ({
          type: String(a.type),
          payload: a.payload ?? null,
          ts: a.ts ?? now,
        })),
      );
    }
    counts.auditLog = trail.length;

    await tx.insert(syncState).values({
      collection: IMPORT_MARKER,
      lastSyncedAt: now,
      meta: { deviceId, counts },
    });
  });

  // Committed: the blobs can go. A crash here is handled by the marker.
  userKeys.forEach((k) => removeKey(user, k));
  return { imported: true, counts };
}
