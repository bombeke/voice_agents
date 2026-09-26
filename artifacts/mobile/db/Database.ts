import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

type TableName = schema.TableName;

/**
 * Drizzle over whichever driver is open (op-sqlite on the device, node:sqlite
 * in tests). Typed reads go through it; so do writes, but only inside
 * `Database.write`.
 */
export type Orm = BaseSQLiteDatabase<"async", unknown, typeof schema>;

/**
 * The durable store. One per signed-in user.
 *
 * Every write goes through `write`, which runs it in one native transaction:
 * all of it commits or none of it does, and live queries fire only after the
 * commit. Don't use Drizzle's own `transaction()`: for op-sqlite it neither
 * awaits the callback nor rolls back on an async error.
 */
export interface Database {
  readonly orm: Orm;
  /** Runs `fn` in one transaction; rethrows after rolling back. Writes are serialised. */
  write<T>(fn: (tx: Orm) => Promise<T>): Promise<T>;
  /** Raw statements outside a transaction (pragmas, migrations). */
  exec(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  /** Calls `listener` after a commit that changed any of `tables`. */
  onChange(tables: readonly TableName[], listener: () => void): () => void;
  close(): Promise<void>;
}

/**
 * Change notification for drivers without native reactive queries (tests,
 * web). Tables are read off the write statements Drizzle generates.
 */
export class ChangeBus {
  private listeners = new Set<{
    tables: ReadonlySet<string>;
    listener: () => void;
  }>();
  private pending = new Set<string>();

  /** Notes the table a statement writes to, if it writes. */
  track(sql: string) {
    const m =
      /^\s*(?:insert\s+(?:or\s+\w+\s+)?into|update|delete\s+from|replace\s+into)\s+[`"]?(\w+)/i.exec(
        sql,
      );
    if (m) this.pending.add(m[1]);
  }

  discard() {
    this.pending.clear();
  }

  flush() {
    if (!this.pending.size) return;
    const changed = this.pending;
    this.pending = new Set();
    for (const { tables, listener } of [...this.listeners]) {
      for (const t of changed) {
        if (tables.has(t)) {
          listener();
          break;
        }
      }
    }
  }

  subscribe(tables: readonly string[], listener: () => void) {
    const entry = { tables: new Set(tables), listener };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }
}

/**
 * Serialises async work: a transaction must not start while another one's
 * statements are still running on the same connection.
 */
export function createLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}
