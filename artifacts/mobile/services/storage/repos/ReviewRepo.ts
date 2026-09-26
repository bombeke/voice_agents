import type { Orm } from "@/db/Database";
import {
  outbox,
  reviewDecisions,
  reviewItems,
  reviewStatus,
  syncState,
} from "@/db/schema";
import type { ReviewFilter } from "@/helpers/reviewQueue";
import { enqueue } from "@/services/sync/Outbox";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewBatch,
  ReviewBatchResponse,
  ReviewDecision,
  ReviewItem,
  ReviewOutcome,
} from "@/types/Review";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { setCaptureFlagged, upsertTeamRecords } from "./CaptureRepo";

export const REVIEW_BATCH_COLLECTION = "review_batch";

const FILTER_KIND: Record<Exclude<ReviewFilter, "all">, string> = {
  low_confidence: "low_confidence",
  gps: "gps_unverified",
  duplicate: "duplicate",
};

/**
 * Adds a downloaded batch: its items join the queue (one per id, never one
 * already decided here), its records become readable offline, and the batch
 * is remembered.
 */
export async function applyReviewBatch(
  tx: Orm,
  { batchId, items, records }: ReviewBatchResponse,
  now: number,
) {
  const ids = items.map((i) => i.id);
  const decided = ids.length
    ? new Set(
        (
          await tx
            .select({ id: reviewDecisions.itemId })
            .from(reviewDecisions)
            .where(inArray(reviewDecisions.itemId, ids))
        ).map((r) => r.id),
      )
    : new Set<string>();
  const fresh = items.filter((i) => !decided.has(i.id));
  for (let i = 0; i < fresh.length; i += 200) {
    await tx
      .insert(reviewItems)
      .values(
        fresh.slice(i, i + 200).map((item) => ({
          id: item.id,
          captureId: item.captureId ?? null,
          reasonKind: item.reason.kind,
          capturedAt: Date.parse(item.capturedAt) || 0,
          data: item,
        })),
      )
      .onConflictDoNothing();
  }
  await upsertTeamRecords(tx, records, now);
  const batch: ReviewBatch = {
    id: batchId,
    downloadedAt: new Date(now).toISOString(),
    size: items.length,
  };
  await tx
    .insert(syncState)
    .values({
      collection: REVIEW_BATCH_COLLECTION,
      lastSyncedAt: now,
      meta: { ...batch },
    })
    .onConflictDoUpdate({
      target: syncState.collection,
      set: { lastSyncedAt: now, meta: { ...batch } },
    });
}

/**
 * Approves or rejects a queued record, in one transaction: it leaves the
 * queue, the decision is stored and queued for upload, and its capture is
 * no longer flagged here. False when the item isn't queued (already decided).
 */
export async function decideReview(
  tx: Orm,
  itemId: string,
  outcome: ReviewOutcome,
  rejectReason: RejectReason | undefined,
  now: number,
): Promise<boolean> {
  const [row] = await tx
    .select({ data: reviewItems.data })
    .from(reviewItems)
    .where(eq(reviewItems.id, itemId));
  if (!row) return false;
  const item = row.data;
  const decision: ReviewDecision = {
    itemId,
    captureId: item.captureId,
    outcome,
    rejectReason: outcome === "rejected" ? rejectReason : undefined,
    decidedAt: new Date(now).toISOString(),
    syncStatus: "pending",
  };
  await tx.delete(reviewItems).where(eq(reviewItems.id, itemId));
  await tx
    .insert(reviewDecisions)
    .values({
      itemId,
      captureId: item.captureId ?? null,
      outcome,
      rejectReason: decision.rejectReason ?? null,
      decidedAt: now,
      syncStatus: "pending",
    })
    .onConflictDoNothing();
  await enqueue(
    tx,
    {
      entity: "review_decision",
      entityId: itemId,
      op: "insert",
      payload: { ...decision },
      idempotencyKey: `review-${itemId}`,
    },
    now,
  );
  if (item.captureId) await setCaptureFlagged(tx, [item.captureId], false);
  return true;
}

export async function setDecisionStatus(
  tx: Orm,
  itemId: string,
  status: ReviewDecision["syncStatus"],
) {
  await tx
    .update(reviewDecisions)
    .set({ syncStatus: status })
    .where(eq(reviewDecisions.itemId, itemId));
}

/** Replaces the known verdicts with the server's list. */
export async function replaceMyReviews(
  tx: Orm,
  statuses: readonly MyReviewStatus[],
) {
  await tx.delete(reviewStatus);
  for (let i = 0; i < statuses.length; i += 200) {
    await tx.insert(reviewStatus).values(
      statuses.slice(i, i + 200).map((s) => ({
        captureId: s.captureId,
        state: s.state,
        data: s,
      })),
    );
  }
}

// ----- Reads -----

/** The filter's matches, newest first. The queue is a downloaded batch, so bounded. */
export async function reviewQueue(
  orm: Orm,
  filter: ReviewFilter,
  limit = 500,
): Promise<ReviewItem[]> {
  const rows = await orm
    .select({ data: reviewItems.data })
    .from(reviewItems)
    .where(
      filter === "all"
        ? undefined
        : eq(reviewItems.reasonKind, FILTER_KIND[filter]),
    )
    .orderBy(desc(reviewItems.capturedAt), desc(reviewItems.id))
    .limit(limit);
  return rows.map((r) => r.data);
}

export interface ReviewCounts {
  queued: number;
  /** Decisions the server hasn't confirmed yet. */
  unsent: number;
  /** The user's own records a supervisor rejected. */
  rejected: number;
}

export async function reviewCounts(orm: Orm): Promise<ReviewCounts> {
  const [q] = await orm.select({ n: sql<number>`count(*)` }).from(reviewItems);
  const [u] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(reviewDecisions)
    .where(ne(reviewDecisions.syncStatus, "synced"));
  const [r] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(reviewStatus)
    .where(eq(reviewStatus.state, "rejected"));
  return {
    queued: Number(q?.n ?? 0),
    unsent: Number(u?.n ?? 0),
    rejected: Number(r?.n ?? 0),
  };
}

export async function lastReviewBatch(orm: Orm): Promise<ReviewBatch | null> {
  const [row] = await orm
    .select({ meta: syncState.meta })
    .from(syncState)
    .where(eq(syncState.collection, REVIEW_BATCH_COLLECTION));
  return (row?.meta as unknown as ReviewBatch | undefined) ?? null;
}

/** Decisions still waiting in the outbox, oldest first (for tests and support). */
export async function unsentDecisionIds(orm: Orm): Promise<string[]> {
  const rows = await orm
    .select({ id: outbox.entityId })
    .from(outbox)
    .where(
      and(eq(outbox.entity, "review_decision"), eq(outbox.state, "pending")),
    )
    .orderBy(outbox.createdAt);
  return rows.map((r) => r.id);
}
