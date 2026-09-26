import type { Orm } from "@/db/Database";
import { attachments, auditLog, observations } from "@/db/schema";
import {
  stampLocalEdit,
  updatedAtMs,
  type Versioned,
} from "@/services/sync/ConflictResolver";
import { enqueue } from "@/services/sync/Outbox";
import type { LocalPole } from "@/types/Observation";
import { and, between, eq, inArray, lt, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";

export type ObservationRow = typeof observations.$inferSelect;

/** Who is writing and when; passed in so tests and imports control both. */
export interface WriteContext {
  deviceId: string;
  now: number;
}

const AUDIT_LOG_LIMIT = 500;

/** The pole a row stores, with the row's version columns as the truth. */
export function poleFromRow(row: ObservationRow): Versioned & LocalPole {
  return {
    ...(row.data as LocalPole),
    pid: row.pid,
    vc: row.vc,
    deleted: row.deleted,
    synced: row.synced,
  } as Versioned & LocalPole;
}

export function rowFromPole(
  pole: Versioned & LocalPole,
  captureId: string | null,
  now: number,
): typeof observations.$inferInsert {
  return {
    pid: pole.pid,
    captureId,
    category: pole.category ?? null,
    latitude: Number.isFinite(pole.latitude) ? pole.latitude! : null,
    longitude: Number.isFinite(pole.longitude) ? pole.longitude! : null,
    capturedAt: Number.isFinite(pole.timestamp) ? pole.timestamp! : null,
    updatedAt: updatedAtMs(pole) || now,
    deviceId: pole.deviceId ?? "",
    vc: pole.vc ?? {},
    deleted: !!pole.deleted,
    synced: !!pole.synced,
    syncedAt: pole.synced ? now : null,
    data: pole as Record<string, unknown>,
  };
}

const EXCLUDED = (col: string) => sql.raw(`excluded.${col}`);

/** Inserts or replaces observation rows in one statement. */
export async function upsertObservationRows(
  tx: Orm,
  rows: (typeof observations.$inferInsert)[],
) {
  if (!rows.length) return;
  await tx
    .insert(observations)
    .values(rows)
    .onConflictDoUpdate({
      target: observations.pid,
      set: {
        // A later save that doesn't know the capture keeps the earlier link.
        captureId: sql`coalesce(excluded.capture_id, ${observations.captureId})`,
        category: EXCLUDED("category"),
        latitude: EXCLUDED("latitude"),
        longitude: EXCLUDED("longitude"),
        capturedAt: EXCLUDED("captured_at"),
        updatedAt: EXCLUDED("updated_at"),
        deviceId: EXCLUDED("device_id"),
        vc: EXCLUDED("vc"),
        deleted: EXCLUDED("deleted"),
        synced: EXCLUDED("synced"),
        syncedAt: EXCLUDED("synced_at"),
        data: EXCLUDED("data"),
      },
    });
}

export async function loadObservations(
  tx: Orm,
  pids: readonly string[],
): Promise<Map<string, ObservationRow>> {
  const out = new Map<string, ObservationRow>();
  // SQLite's bound-variable limit is far above a batch; chunk anyway.
  for (let i = 0; i < pids.length; i += 500) {
    const rows = await tx
      .select()
      .from(observations)
      .where(inArray(observations.pid, pids.slice(i, i + 500) as string[]));
    rows.forEach((r) => out.set(r.pid, r));
  }
  return out;
}

const idempotencyKey = (pole: Versioned, deviceId: string) =>
  `pole-${pole.pid}-${deviceId}-${pole.vc?.[deviceId] ?? 0}`;

/** A photo still on this device, as opposed to a URL the server gave us. */
const isLocalFile = (uri?: string) => !!uri && !/^https?:\/\//i.test(uri);

export async function appendAudit(
  tx: Orm,
  entries: { type: string; payload: unknown }[],
  now: number,
) {
  if (!entries.length) return;
  await tx
    .insert(auditLog)
    .values(
      entries.map((e) => ({ type: e.type, payload: e.payload, ts: now })),
    );
  // Keep the newest rows; the id index makes this a range delete.
  await tx.run(
    sql`DELETE FROM audit_log WHERE id <= (SELECT max(id) FROM audit_log) - ${AUDIT_LOG_LIMIT}`,
  );
}

/**
 * Saves poles (new ones, or changed fields of existing ones) inside the
 * caller's transaction: each is stamped as a local edit, stored, queued for
 * upload and, if it has a photo on the device, queued for the photo upload.
 * Files must already be where they will stay (see ImageStore).
 */
export async function saveObservations(
  tx: Orm,
  input: readonly LocalPole[],
  {
    deviceId,
    now,
    captureId = null,
  }: WriteContext & { captureId?: string | null },
): Promise<(Versioned & LocalPole)[]> {
  const withIds = input.map((p) => ({ ...p, pid: p.pid ?? randomUUID() }));
  const prev = await loadObservations(
    tx,
    withIds.map((p) => p.pid),
  );

  const saved: (Versioned & LocalPole)[] = [];
  for (const pole of withIds) {
    const before = prev.get(pole.pid);
    const stamped = stampLocalEdit(
      before ? poleFromRow(before) : undefined,
      pole as Partial<Versioned> & { pid: string },
      deviceId,
      now,
    ) as Versioned & LocalPole;
    saved.push(stamped);
    await enqueue(
      tx,
      {
        entity: "observation",
        entityId: stamped.pid,
        op: before && !before.deleted ? "update" : "insert",
        payload: stamped,
        idempotencyKey: idempotencyKey(stamped, deviceId),
      },
      now,
    );
    if (isLocalFile(stamped.imageUri)) {
      await tx
        .insert(attachments)
        .values({
          id: randomUUID(),
          entityId: stamped.pid,
          localPath: stamped.imageUri!,
          createdAt: now,
        })
        .onConflictDoNothing();
    }
  }
  await upsertObservationRows(
    tx,
    saved.map((p) => rowFromPole(p, captureId, now)),
  );
  await appendAudit(
    tx,
    saved.map((p) => ({ type: "POLE_UPSERT", payload: { pid: p.pid } })),
    now,
  );
  return saved;
}

/**
 * Deletes a pole: a tombstone stays until the server has the delete, and
 * its photo upload is cancelled. Returns the photo path the caller may free.
 */
export async function deleteObservation(
  tx: Orm,
  pid: string,
  { deviceId, now }: WriteContext,
): Promise<string | undefined> {
  const before = (await loadObservations(tx, [pid])).get(pid);
  const prev = before ? poleFromRow(before) : undefined;
  const tombstone = stampLocalEdit(prev, { pid, deleted: true }, deviceId, now);
  await upsertObservationRows(tx, [
    rowFromPole(
      tombstone as Versioned & LocalPole,
      before?.captureId ?? null,
      now,
    ),
  ]);
  await enqueue(
    tx,
    {
      entity: "observation",
      entityId: pid,
      op: "delete",
      payload: {
        pid,
        id: prev?.id,
        deleted: true,
        vc: tombstone.vc,
        updatedAt: tombstone.updatedAt,
        deviceId,
      },
      idempotencyKey: idempotencyKey(tombstone, deviceId),
    },
    now,
  );
  await tx
    .delete(attachments)
    .where(
      and(
        eq(attachments.entityId, pid),
        inArray(attachments.state, ["pending", "failed"]),
      ),
    );
  await appendAudit(tx, [{ type: "POLE_DELETE", payload: { pid } }], now);
  return prev?.imageUri;
}

/** Whether any live pole still points at this photo. */
export async function isImageReferenced(orm: Orm, uri: string) {
  const [row] = await orm
    .select({ pid: observations.pid })
    .from(observations)
    .where(
      and(
        eq(observations.deleted, false),
        sql`json_extract(${observations.data}, '$.imageUri') = ${uri}`,
      ),
    )
    .limit(1);
  return !!row;
}

/** ~111 km per degree of latitude. */
const M_PER_DEG = 111_320;

/**
 * Live poles within `radiusM` of a point: an indexed box on latitude, then
 * longitude. For the duplicate check, which only needs the neighbourhood.
 */
export async function nearbyObservations(
  orm: Orm,
  at: { latitude: number; longitude: number },
  radiusM: number,
  limit = 200,
): Promise<LocalPole[]> {
  const dLat = radiusM / M_PER_DEG;
  const dLng =
    radiusM /
    (M_PER_DEG * Math.max(Math.cos((at.latitude * Math.PI) / 180), 0.01));
  const rows = await orm
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.deleted, false),
        between(observations.latitude, at.latitude - dLat, at.latitude + dLat),
        between(
          observations.longitude,
          at.longitude - dLng,
          at.longitude + dLng,
        ),
      ),
    )
    .limit(limit);
  return rows.map(poleFromRow);
}

/** The poles of a capture that exist on this device. */
export async function capturePoleIds(orm: Orm, pids: readonly string[]) {
  const rows = await loadObservations(orm, pids);
  return new Set(
    [...rows.values()].filter((r) => !r.deleted).map((r) => r.pid),
  );
}

/** Tombstones the server has confirmed, older than `before`: safe to forget. */
export async function purgeTombstones(tx: Orm, before: number) {
  await tx
    .delete(observations)
    .where(
      and(
        eq(observations.deleted, true),
        eq(observations.synced, true),
        lt(observations.updatedAt, before),
      ),
    );
}
