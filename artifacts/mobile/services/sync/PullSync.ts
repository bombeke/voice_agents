import type { Database, Orm } from "@/db/Database";
import { attachments, syncState } from "@/db/schema";
import {
  loadObservations,
  poleFromRow,
  rowFromPole,
  upsertObservationRows,
} from "@/services/storage/repos/ObservationRepo";
import { refreshCaptureStatus } from "@/services/storage/repos/CaptureRepo";
import type { LocalPole } from "@/types/Observation";
import { and, eq, inArray } from "drizzle-orm";
import { resolveConflict, type Versioned } from "./ConflictResolver";
import type { ChangesPage } from "./Endpoints";
import { cancelQueued, enqueue, queuedIds } from "./Outbox";

export const OBSERVATIONS_COLLECTION = "observations";
export const PULL_BATCH_SIZE = 500;

export type FetchChanges = (
  cursor: string | null,
  limit: number,
) => Promise<ChangesPage>;

export interface PullOptions {
  db: Database;
  fetchPage: FetchChanges;
  deviceId: string;
  batchSize?: number;
  now?: () => number;
  /** Stops after this many pages (the next run resumes from the cursor). */
  maxPages?: number;
  /** Test hook: inside each page's transaction, after its writes, before COMMIT. */
  beforeCommit?: (pageIndex: number) => void | Promise<void>;
}

export interface PullResult {
  pages: number;
  applied: number;
  cursor: string | null;
  /** Photo files of records the server deleted; the caller frees them. */
  released: string[];
}

const parseClock = (value: unknown): Record<string, number> => {
  let vc = value;
  if (typeof vc === "string") {
    try {
      vc = JSON.parse(vc);
    } catch {
      return {};
    }
  }
  if (!vc || typeof vc !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(vc)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
};

/** A server row as a pole; undefined if it can't be one (no id, or live but unplaceable). */
export function normalizeRemotePole(
  raw: unknown,
): (Versioned & LocalPole) | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pid = r.pid ?? r.id;
  if (pid == null) return undefined;
  const pole = {
    ...r,
    pid: String(pid),
    vc: parseClock(r.vc),
    deleted: r.deleted === true || r.deleted === "true",
  } as Versioned & LocalPole;
  for (const k of ["latitude", "longitude", "timestamp"] as const) {
    if (r[k] != null) (pole as Record<string, unknown>)[k] = Number(r[k]);
  }
  if (
    !pole.deleted &&
    !(Number.isFinite(pole.latitude) && Number.isFinite(pole.longitude))
  ) {
    return undefined;
  }
  return pole;
}

export async function readCursor(
  orm: Orm,
  collection = OBSERVATIONS_COLLECTION,
) {
  const [row] = await orm
    .select({ cursor: syncState.serverCursor })
    .from(syncState)
    .where(eq(syncState.collection, collection));
  return row?.cursor ?? null;
}

/**
 * Applies one page of server changes in the caller's transaction, cursor
 * included, so the database and the cursor always agree: a page is either
 * fully applied with the cursor after it, or not at all.
 */
export async function applyChangesPage(
  tx: Orm,
  page: ChangesPage,
  { deviceId, now }: { deviceId: string; now: number },
): Promise<{ applied: number; released: string[] }> {
  const remote = page.items
    .map(normalizeRemotePole)
    .filter((p): p is Versioned & LocalPole => !!p);
  // Last change wins within a page.
  const byPid = new Map(remote.map((p) => [p.pid, p]));
  const pids = [...byPid.keys()];

  const locals = await loadObservations(tx, pids);
  const queued = await queuedIds(tx, "observation", pids);

  const rows: ReturnType<typeof rowFromPole>[] = [];
  const cancel: string[] = [];
  const toPush: (Versioned & LocalPole)[] = [];
  const deletedHere: string[] = [];
  const released: string[] = [];
  const touchedCaptures = new Set<string>();

  for (const rp of byPid.values()) {
    const localRow = locals.get(rp.pid);
    if (!localRow && rp.deleted) continue; // Never had it; nothing to delete.
    const res = resolveConflict(
      localRow ? poleFromRow(localRow) : undefined,
      rp,
      {
        deviceId,
        now,
        hasQueued: queued.has(rp.pid),
      },
    );
    const captureId = localRow?.captureId ?? null;
    if (captureId) touchedCaptures.add(captureId);
    if (res.dropQueued) cancel.push(rp.pid);
    if (res.push) toPush.push(res.record as Versioned & LocalPole);
    if (res.record.deleted && !localRow?.deleted) {
      deletedHere.push(rp.pid);
      if (localRow && (localRow.data as LocalPole).imageUri) {
        released.push((localRow.data as LocalPole).imageUri!);
      }
    }
    rows.push(rowFromPole(res.record as Versioned & LocalPole, captureId, now));
  }

  await upsertObservationRows(tx, rows);
  await cancelQueued(tx, "observation", cancel);
  for (const p of toPush) {
    await enqueue(
      tx,
      {
        entity: "observation",
        entityId: p.pid,
        op: p.deleted ? "delete" : "update",
        payload: p,
        idempotencyKey: `pole-${p.pid}-${deviceId}-${p.vc?.[deviceId] ?? 0}`,
      },
      now,
    );
  }
  if (deletedHere.length) {
    await tx
      .delete(attachments)
      .where(
        and(
          inArray(attachments.entityId, deletedHere),
          inArray(attachments.state, ["pending", "failed"]),
        ),
      );
  }
  await refreshCaptureStatus(tx, [...touchedCaptures]);

  const cursor = page.nextCursor;
  if (cursor !== null) {
    await tx
      .insert(syncState)
      .values({
        collection: OBSERVATIONS_COLLECTION,
        serverCursor: cursor,
        lastSyncedAt: page.hasMore ? null : now,
      })
      .onConflictDoUpdate({
        target: syncState.collection,
        set: page.hasMore
          ? { serverCursor: cursor }
          : { serverCursor: cursor, lastSyncedAt: now },
      });
  }
  return { applied: rows.length, released };
}

/**
 * Resumable delta pull: one page per request and one transaction per page,
 * from the stored cursor until the server says there is no more. Killed at
 * any point, the database holds whole pages and the cursor after the last
 * one, so the next run continues from there without gaps or repeats. Never
 * reads a whole table.
 */
export async function pullObservations({
  db,
  fetchPage,
  deviceId,
  batchSize = PULL_BATCH_SIZE,
  now = Date.now,
  maxPages = Infinity,
  beforeCommit,
}: PullOptions): Promise<PullResult> {
  let cursor = await readCursor(db.orm);
  let pages = 0;
  let applied = 0;
  const released: string[] = [];

  while (pages < maxPages) {
    const page = await fetchPage(cursor, batchSize);
    const index = pages;
    const result = await db.write(async (tx) => {
      const r = await applyChangesPage(tx, page, { deviceId, now: now() });
      await beforeCommit?.(index);
      return r;
    });
    pages++;
    applied += result.applied;
    released.push(...result.released);
    if (page.nextCursor !== null) cursor = page.nextCursor;
    if (!page.hasMore) break;
  }
  return { pages, applied, cursor, released };
}
