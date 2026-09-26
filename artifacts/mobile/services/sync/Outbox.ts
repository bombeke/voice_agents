import type { Orm } from "@/db/Database";
import { outbox, type OutboxEntity, type OutboxOp } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "expo-crypto";

export type OutboxRow = typeof outbox.$inferSelect;

export interface OutboxEntry {
  entity: OutboxEntity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>;
  /** The same version must produce the same key, so the server can deduplicate retries. */
  idempotencyKey: string;
}

/**
 * The row the drain worker is sending. It can't be replaced or cancelled: the
 * server may already have it. Module state, as there is one worker.
 */
let inFlightId: string | null = null;

export const inFlightOutboxId = () => inFlightId;

export function setInFlightOutboxId(id: string | null) {
  inFlightId = id;
}

/**
 * Queues a change, inside the caller's transaction. At most one waiting row
 * per record: a newer change replaces the waiting one (and a refused one),
 * an insert the server never saw stays an insert, and deleting such a record
 * drops it altogether. Returns the new row, or null when nothing needs sending.
 */
export async function enqueue(
  tx: Orm,
  entry: OutboxEntry,
  now: number,
): Promise<OutboxRow | null> {
  const existing = await tx
    .select()
    .from(outbox)
    .where(
      and(eq(outbox.entity, entry.entity), eq(outbox.entityId, entry.entityId)),
    );
  const waiting = existing.filter((r) => r.id !== inFlightId);
  const unsentInsert = waiting.some(
    (r) => r.op === "insert" && r.state === "pending",
  );

  if (waiting.length) {
    await tx.delete(outbox).where(
      inArray(
        outbox.id,
        waiting.map((r) => r.id),
      ),
    );
  }
  if (unsentInsert && entry.op === "delete") return null;

  const row: OutboxRow = {
    id: randomUUID(),
    entity: entry.entity,
    entityId: entry.entityId,
    op: unsentInsert ? "insert" : entry.op,
    payload: entry.payload,
    idempotencyKey: entry.idempotencyKey,
    createdAt: now,
    attemptCount: 0,
    nextAttemptAt: now,
    lastError: null,
    state: "pending",
    lastStatus: null,
  };
  // The same version queued twice (e.g. a re-run import) is one delivery.
  await tx.insert(outbox).values(row).onConflictDoNothing();
  return row;
}

/** Drops waiting rows for these records (not the one in flight). */
export async function cancelQueued(
  tx: Orm,
  entity: OutboxEntity,
  entityIds: readonly string[],
) {
  if (!entityIds.length) return;
  const rows = await tx
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(eq(outbox.entity, entity), inArray(outbox.entityId, [...entityIds])),
    );
  const ids = rows.map((r) => r.id).filter((id) => id !== inFlightId);
  if (ids.length) await tx.delete(outbox).where(inArray(outbox.id, ids));
}

/** Records of `entity` that still have a waiting (pending) row. */
export async function queuedIds(
  tx: Orm,
  entity: OutboxEntity,
  entityIds: readonly string[],
): Promise<Set<string>> {
  if (!entityIds.length) return new Set();
  const rows = await tx
    .select({ entityId: outbox.entityId })
    .from(outbox)
    .where(
      and(
        eq(outbox.entity, entity),
        eq(outbox.state, "pending"),
        inArray(outbox.entityId, [...entityIds]),
      ),
    );
  return new Set(rows.map((r) => r.entityId));
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Wakes the drain worker; call after a commit that queued something. */
export function signalOutbox() {
  listeners.forEach((l) => l());
}

export function onOutboxSignal(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
