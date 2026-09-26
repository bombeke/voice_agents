import { strings } from "@/constants/Strings";
import type { Orm } from "@/db/Database";
import type { Keyset, KeysetQuery } from "@/db/LiveQuery";
import { captures, reviewStatus, type RecordScope } from "@/db/schema";
import type { TodayStats } from "@/helpers/captureStats";
import type { RecordCounts, RecordFilter } from "@/helpers/records";
import type {
  CaptureRecord,
  CaptureSummary,
  CaptureSyncStatus,
} from "@/types/Capture";
import type { MyReviewStatus, TeamRecord } from "@/types/Review";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

export type CaptureRow = typeof captures.$inferSelect;

/** Lower-cased text the Records search matches: name, detail, code, category, owner. */
export function searchText(summary: CaptureSummary): string {
  return [
    summary.title,
    summary.detail,
    summary.assetId,
    strings.categories[summary.category]?.label,
    summary.capturedBy?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function captureRow(
  summary: CaptureSummary,
  record: CaptureRecord | null,
  scope: RecordScope,
  now: number,
): typeof captures.$inferInsert {
  return {
    id: summary.id,
    scope,
    ownerId: summary.capturedBy?.id ?? null,
    category: summary.category,
    assetId: summary.assetId ?? null,
    capturedAt: Date.parse(summary.capturedAt) || 0,
    syncStatus: summary.syncStatus,
    flagged: summary.flagged,
    search: searchText(summary),
    summary,
    record,
    updatedAt: now,
  };
}

const EXCLUDED = (col: string) => sql.raw(`excluded.${col}`);

/** The outer row's id, qualified, for correlated subqueries. */
const CAPTURE_ID = sql.raw(`"captures"."id"`);

const UPSERT_SET = {
  scope: EXCLUDED("scope"),
  ownerId: EXCLUDED("owner_id"),
  category: EXCLUDED("category"),
  assetId: EXCLUDED("asset_id"),
  capturedAt: EXCLUDED("captured_at"),
  syncStatus: EXCLUDED("sync_status"),
  flagged: EXCLUDED("flagged"),
  search: EXCLUDED("search"),
  summary: EXCLUDED("summary"),
  record: sql`coalesce(excluded.record, ${captures.record})`,
  updatedAt: EXCLUDED("updated_at"),
};

/** The user's own captures, in the caller's transaction. */
export async function upsertOwnCaptures(
  tx: Orm,
  rows: (typeof captures.$inferInsert)[],
) {
  for (let i = 0; i < rows.length; i += 200) {
    await tx
      .insert(captures)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({ target: captures.id, set: UPSERT_SET });
  }
}

/** Team records; never overwrite one of the user's own under the same id. */
export async function upsertTeamRecords(
  tx: Orm,
  records: readonly TeamRecord[],
  now: number,
) {
  const rows = records.map((r) => captureRow(r.summary, r.record, "team", now));
  for (let i = 0; i < rows.length; i += 200) {
    await tx
      .insert(captures)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: captures.id,
        set: UPSERT_SET,
        setWhere: eq(captures.scope, "team"),
      });
  }
}

export async function setCaptureFlagged(
  tx: Orm,
  ids: readonly string[],
  flagged: boolean,
) {
  if (!ids.length) return;
  const rows = await tx
    .select({ id: captures.id, summary: captures.summary })
    .from(captures)
    .where(and(inArray(captures.id, [...ids]), ne(captures.flagged, flagged)));
  for (const { id, summary } of rows) {
    await tx
      .update(captures)
      .set({ flagged, summary: { ...summary, flagged } })
      .where(eq(captures.id, id));
  }
}

async function setStatus(
  tx: Orm,
  ids: readonly string[],
  status: CaptureSyncStatus,
) {
  if (!ids.length) return;
  const rows = await tx
    .select({ id: captures.id, summary: captures.summary })
    .from(captures)
    .where(
      and(
        eq(captures.scope, "mine"),
        inArray(captures.id, [...ids]),
        ne(captures.syncStatus, status),
      ),
    );
  for (const { id, summary } of rows) {
    await tx
      .update(captures)
      .set({ syncStatus: status, summary: { ...summary, syncStatus: status } })
      .where(eq(captures.id, id));
  }
}

/**
 * Works out each capture's sync state from what is still waiting for it: a
 * refused upload → failed; anything queued (record or photo) → pending;
 * nothing left → synced.
 */
export async function refreshCaptureStatus(
  tx: Orm,
  captureIds: readonly string[],
) {
  const ids = [...new Set(captureIds.filter(Boolean))];
  if (!ids.length) return;
  // Typed select, not orm.all(): Drizzle's op-sqlite all() without fields
  // reads rows off an unawaited promise and always returns [].
  // CAPTURE_ID is spelled out: Drizzle renders ${captures.id} in a
  // single-table select as a bare "id", which inside these subqueries
  // would resolve to outbox.id.
  const rows = await tx
    .select({
      id: captures.id,
      refused: sql<number>`EXISTS (SELECT 1 FROM observations ob JOIN outbox o
          ON o.entity = 'observation' AND o.entity_id = ob.pid
        WHERE ob.capture_id = ${CAPTURE_ID} AND o.state = 'failed')`,
      photoFailed: sql<number>`EXISTS (SELECT 1 FROM observations ob
          JOIN attachments a ON a.entity_id = ob.pid
        WHERE ob.capture_id = ${CAPTURE_ID} AND a.state = 'failed')`,
      queued: sql<number>`EXISTS (SELECT 1 FROM observations ob JOIN outbox o
          ON o.entity = 'observation' AND o.entity_id = ob.pid
        WHERE ob.capture_id = ${CAPTURE_ID} AND o.state = 'pending')`,
      photos: sql<number>`EXISTS (SELECT 1 FROM observations ob
          JOIN attachments a ON a.entity_id = ob.pid
        WHERE ob.capture_id = ${CAPTURE_ID} AND a.state IN ('pending', 'uploading'))`,
    })
    .from(captures)
    .where(and(eq(captures.scope, "mine"), inArray(captures.id, ids)));

  const by: Record<CaptureSyncStatus, string[]> = {
    failed: [],
    pending: [],
    synced: [],
    uploading: [],
  };
  for (const { id, refused, photoFailed, queued, photos } of rows) {
    const status: CaptureSyncStatus =
      Number(refused) || Number(photoFailed)
        ? "failed"
        : Number(queued) || Number(photos)
          ? "pending"
          : "synced";
    by[status].push(id);
  }
  for (const status of Object.keys(by) as CaptureSyncStatus[]) {
    await setStatus(tx, by[status], status);
  }
}

// ----- Reads -----

const FILTER_WHERE: Record<RecordFilter, SQL | undefined> = {
  all: undefined,
  pending: inArray(captures.syncStatus, ["pending", "uploading", "failed"]),
  flagged: eq(captures.flagged, true),
};

/** Escapes LIKE wildcards in user input. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function listWhere(scope: RecordScope, filter: RecordFilter, query: string) {
  const q = query.trim().toLowerCase();
  return and(
    eq(captures.scope, scope),
    FILTER_WHERE[filter],
    q
      ? sql`${captures.search} LIKE ${`%${likeEscape(q)}%`} ESCAPE '\\'`
      : undefined,
  );
}

// Row values, not `a < x OR (a = x AND id < y)`: SQLite seeks the index
// with a row-value comparison, so a page 50k rows down costs what the first does.
const after = (k: Keyset) =>
  sql`(${captures.capturedAt}, ${captures.id}) < (${k.at}, ${k.id})`;

const through = (k: Keyset) =>
  sql`(${captures.capturedAt}, ${captures.id}) >= (${k.at}, ${k.id})`;

/** Records, newest first, one keyset page at a time. */
export function captureListQuery(
  scope: RecordScope,
  filter: RecordFilter,
  query: string,
): KeysetQuery<CaptureSummary> {
  const where = listWhere(scope, filter, query);
  const select = (orm: Orm, bound: SQL | undefined, limit?: number) => {
    const q = orm
      .select({ summary: captures.summary })
      .from(captures)
      .where(and(where, bound))
      .orderBy(desc(captures.capturedAt), desc(captures.id));
    return (limit ? q.limit(limit) : q).then((rows) =>
      rows.map((r) => r.summary),
    );
  };
  return {
    page: (orm, from, limit) =>
      select(orm, from ? after(from) : undefined, limit),
    through: (orm, anchor) => select(orm, through(anchor)),
    keyOf: (s) => ({ at: Date.parse(s.capturedAt) || 0, id: s.id }),
  };
}

/**
 * Tab counts over every record in the scope, index-only: one pass over the
 * status index grouped by state, and a range count on the flagged index.
 * These re-run after every commit to captures, so they never read rows.
 */
export async function captureCounts(
  orm: Orm,
  scope: RecordScope,
): Promise<RecordCounts> {
  const byStatus = await orm
    .select({ status: captures.syncStatus, n: sql<number>`count(*)` })
    .from(captures)
    .where(eq(captures.scope, scope))
    .groupBy(captures.syncStatus);
  const [flagged] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(captures)
    .where(and(eq(captures.scope, scope), eq(captures.flagged, true)));
  const n = (s: CaptureSyncStatus) =>
    Number(byStatus.find((r) => r.status === s)?.n ?? 0);
  const all = byStatus.reduce((sum, r) => sum + Number(r.n), 0);
  return {
    all,
    pending: all - n("synced"),
    flagged: Number(flagged?.n ?? 0),
    uploading: n("uploading"),
    failed: n("failed"),
  };
}

/** Home's numbers; `dayStart`/`dayEnd` are the local day's bounds in epoch ms. */
export async function todayStats(
  orm: Orm,
  dayStart: number,
  dayEnd: number,
): Promise<TodayStats> {
  const [today] = await orm
    .select({
      captured: sql<number>`count(*)`,
      synced: sql<number>`coalesce(sum(${captures.syncStatus} = 'synced'), 0)`,
      flagged: sql<number>`coalesce(sum(${captures.flagged}), 0)`,
    })
    .from(captures)
    .where(
      and(
        eq(captures.scope, "mine"),
        gte(captures.capturedAt, dayStart),
        lt(captures.capturedAt, dayEnd),
      ),
    );
  const [pending] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(captures)
    .where(and(eq(captures.scope, "mine"), FILTER_WHERE.pending));
  return {
    capturedToday: Number(today?.captured ?? 0),
    synced: Number(today?.synced ?? 0),
    flagged: Number(today?.flagged ?? 0),
    pending: Number(pending?.n ?? 0),
  };
}

export async function latestCapture(
  orm: Orm,
): Promise<CaptureSummary | undefined> {
  const [row] = await orm
    .select({ summary: captures.summary })
    .from(captures)
    .where(eq(captures.scope, "mine"))
    .orderBy(desc(captures.capturedAt), desc(captures.id))
    .limit(1);
  return row?.summary;
}

/**
 * The record with this capture id, else the newest capture of this asset
 * code; the user's own before a team record.
 */
export async function findCapture(
  orm: Orm,
  id: string,
): Promise<CaptureRow | undefined> {
  const [byId] = await orm
    .select()
    .from(captures)
    .where(eq(captures.id, id))
    .limit(1);
  if (byId) return byId;
  const [byAsset] = await orm
    .select()
    .from(captures)
    .where(eq(captures.assetId, id))
    .orderBy(sql`${captures.scope} = 'mine' DESC`, desc(captures.capturedAt))
    .limit(1);
  return byAsset;
}

/** Own records of the same asset, newest first, for the condition history. */
export async function assetRecords(
  orm: Orm,
  assetId: string,
  limit = 20,
): Promise<CaptureRecord[]> {
  const rows = await orm
    .select({ record: captures.record })
    .from(captures)
    .where(and(eq(captures.scope, "mine"), eq(captures.assetId, assetId)))
    .orderBy(desc(captures.capturedAt))
    .limit(limit);
  return rows.map((r) => r.record).filter((r): r is CaptureRecord => !!r);
}

export async function getOwnRecord(
  orm: Orm,
  id: string,
): Promise<{ summary: CaptureSummary; record: CaptureRecord } | null> {
  const [row] = await orm
    .select({ summary: captures.summary, record: captures.record })
    .from(captures)
    .where(and(eq(captures.id, id), eq(captures.scope, "mine")))
    .limit(1);
  return row?.record ? { summary: row.summary, record: row.record } : null;
}

/**
 * The user's routed records with the server's verdict, newest first: every
 * flagged capture and any capture the server has a verdict for.
 */
export async function myReviewRows(
  orm: Orm,
  limit = 200,
): Promise<{ capture: CaptureSummary; status: MyReviewStatus }[]> {
  const rows = await orm
    .select({ summary: captures.summary, status: reviewStatus.data })
    .from(captures)
    .leftJoin(reviewStatus, eq(reviewStatus.captureId, captures.id))
    .where(
      and(
        eq(captures.scope, "mine"),
        or(
          eq(captures.flagged, true),
          sql`${reviewStatus.captureId} IS NOT NULL`,
        ),
      ),
    )
    .orderBy(desc(captures.capturedAt))
    .limit(limit);
  return rows.map((r) => ({
    capture: r.summary,
    status: r.status ?? { captureId: r.summary.id, state: "waiting" },
  }));
}

/**
 * Re-derives the state of every own record not marked synced (an indexed
 * set, usually small): a row with nothing left queued settles. Run by
 * "Sync now", which also covers rows from before the outbox existed.
 */
export async function reconcileCaptureStatus(tx: Orm) {
  const rows = await tx
    .select({ id: captures.id })
    .from(captures)
    .where(and(eq(captures.scope, "mine"), FILTER_WHERE.pending));
  for (let i = 0; i < rows.length; i += 500) {
    await refreshCaptureStatus(
      tx,
      rows.slice(i, i + 500).map((r) => r.id),
    );
  }
}
