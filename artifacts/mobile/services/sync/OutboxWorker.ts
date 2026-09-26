import type { Database, Orm } from "@/db/Database";
import { outbox, type OutboxEntity } from "@/db/schema";
import { and, asc, eq, gt, lte, min } from "drizzle-orm";
import { nextAttemptAt } from "./Backoff";
import { setInFlightOutboxId, type OutboxRow } from "./Outbox";

export type SendOutcome = "done" | "retry" | "fail";

/** How one kind of outbox row reaches the server, and what delivery means locally. */
export interface OutboxHandler {
  send(row: OutboxRow): Promise<void>;
  /** Defaults to `classifyError`. */
  classify?(err: unknown, row: OutboxRow): SendOutcome;
  /** In the transaction that removes the row. */
  onDelivered(tx: Orm, row: OutboxRow, now: number): Promise<void>;
  /** In the transaction that parks the row as failed. */
  onRefused(tx: Orm, row: OutboxRow, now: number): Promise<void>;
}

export type OutboxHandlers = Record<OutboxEntity, OutboxHandler>;

export interface DrainResult {
  sent: number;
  failed: number;
  /** A send failed and will be retried; the run stopped there. */
  deferred: boolean;
  /** When the next waiting row is due; null when the outbox is empty. */
  nextDueAt: number | null;
}

/** 5xx responses are retried this many times before the row is parked. */
export const MAX_SERVER_ERROR_ATTEMPTS = 8;

const statusOf = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

export const errorMessage = (err: unknown) =>
  String(
    (err as { response?: { data?: { message?: string; detail?: string } } })
      ?.response?.data?.message ??
      (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail ??
      (err as Error)?.message ??
      err,
  );

/** Offline, auth and throttling retry; 409 means the server already has it. */
export function classifyError(err: unknown, row: OutboxRow): SendOutcome {
  const status = statusOf(err);
  if (!status) return "retry"; // offline / timeout
  if (status === 409) return "done";
  if (row.op === "delete" && (status === 404 || status === 410)) return "done";
  if ([401, 403, 408, 425, 429].includes(status)) return "retry";
  if (status >= 500) {
    return row.attemptCount + 1 >= MAX_SERVER_ERROR_ATTEMPTS ? "fail" : "retry";
  }
  return "fail";
}

interface DrainOptions {
  now?: () => number;
  random?: () => number;
}

/**
 * Sends due rows oldest first until the outbox is empty or a send has to be
 * retried (usually: offline). Every outcome is committed before the next row,
 * so a kill at any point loses nothing: an unacknowledged row is sent again
 * with the same idempotency key.
 */
export async function drainOutbox(
  db: Database,
  handlers: OutboxHandlers,
  { now = Date.now, random = Math.random }: DrainOptions = {},
): Promise<DrainResult> {
  let sent = 0;
  let failed = 0;

  while (true) {
    const [row] = await db.orm
      .select()
      .from(outbox)
      .where(and(eq(outbox.state, "pending"), lte(outbox.nextAttemptAt, now())))
      .orderBy(asc(outbox.createdAt), asc(outbox.id))
      .limit(1);
    if (!row) break;

    const handler = handlers[row.entity];
    let outcome: SendOutcome;
    let error: unknown;
    setInFlightOutboxId(row.id);
    try {
      await handler.send(row);
      outcome = "done";
    } catch (err) {
      error = err;
      outcome = (handler.classify ?? classifyError)(err, row);
    } finally {
      setInFlightOutboxId(null);
    }

    const at = now();
    if (outcome === "done") {
      await db.write(async (tx) => {
        await tx.delete(outbox).where(eq(outbox.id, row.id));
        await handler.onDelivered(tx, row, at);
      });
      sent++;
      continue;
    }
    if (outcome === "fail") {
      await db.write(async (tx) => {
        await tx
          .update(outbox)
          .set({
            state: "failed",
            attemptCount: row.attemptCount + 1,
            lastError: errorMessage(error),
            lastStatus: statusOf(error) ?? null,
          })
          .where(eq(outbox.id, row.id));
        await handler.onRefused(tx, row, at);
      });
      console.warn(
        `[outbox] server refused ${row.entity} ${row.entityId}:`,
        errorMessage(error),
      );
      failed++;
      continue;
    }
    const attempt = row.attemptCount + 1;
    await db.write((tx) =>
      tx
        .update(outbox)
        .set({
          attemptCount: attempt,
          nextAttemptAt: nextAttemptAt(attempt, at, random),
          lastError: errorMessage(error),
          lastStatus: statusOf(error) ?? null,
        })
        .where(eq(outbox.id, row.id)),
    );
    return { sent, failed, deferred: true, nextDueAt: await nextDue(db) };
  }
  return { sent, failed, deferred: false, nextDueAt: await nextDue(db) };
}

async function nextDue(db: Database): Promise<number | null> {
  const [row] = await db.orm
    .select({ at: min(outbox.nextAttemptAt) })
    .from(outbox)
    .where(eq(outbox.state, "pending"));
  return row?.at ?? null;
}

/**
 * "Sync now": refused rows go back in line and rows waiting out a backoff
 * become due, so everything is tried now, oldest first.
 */
export async function retryFailed(db: Database, now = Date.now()) {
  await db.write(async (tx) => {
    await tx
      .update(outbox)
      .set({ state: "pending", nextAttemptAt: now, attemptCount: 0 })
      .where(eq(outbox.state, "failed"));
    await tx
      .update(outbox)
      .set({ nextAttemptAt: now })
      .where(and(eq(outbox.state, "pending"), gt(outbox.nextAttemptAt, now)));
  });
}
