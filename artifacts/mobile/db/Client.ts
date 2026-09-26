import { open, type DB } from "@op-engineering/op-sqlite";
import { drizzle } from "drizzle-orm/op-sqlite";
import type { Database, Orm } from "./Database";
import * as schema from "./schema";
import { timed } from "./Timing";

export interface OpenOptions {
  /** File name, e.g. `iip-user-<id>.db`. */
  name: string;
  /**
   * SQLCipher key. Pass a raw 256-bit key as `x'<64 hex>'`: SQLCipher then
   * skips PBKDF2, which would otherwise cost tens of ms on every cold start.
   */
  encryptionKey?: string;
}

const PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  // Safe with WAL: a crash can lose the last commits, never corrupt the file.
  "PRAGMA synchronous = NORMAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA busy_timeout = 5000",
  "PRAGMA temp_store = MEMORY",
];

/**
 * The connection as Drizzle's op-sqlite driver expects it. Drizzle (0.45)
 * reads typed rows through `executeRawAsync` and wants the row arrays back;
 * op-sqlite 17+ returns `{ rawRows, columnNames }` instead, so every select
 * failed with "rows.map is not a function". Everything else is passed through.
 */
export function forDrizzle(raw: DB): DB {
  return {
    ...raw,
    executeRawAsync: async (query: string, params?: unknown[]) =>
      (await raw.executeRaw(query, params as never)).rawRows ?? [],
  } as DB;
}

/** Opens the user's database on the device (op-sqlite, SQLCipher build). */
export async function openDatabase({
  name,
  encryptionKey,
}: OpenOptions): Promise<Database> {
  const raw: DB = open({ name, encryptionKey });
  for (const pragma of PRAGMAS) await raw.execute(pragma);
  const orm = drizzle(forDrizzle(raw), { schema }) as unknown as Orm;

  return {
    orm,
    write<T>(fn: (tx: Orm) => Promise<T>) {
      let result: T;
      return timed("write", async () => {
        // op-sqlite queues transactions itself and flushes reactive queries
        // after COMMIT. Drizzle statements run on the same connection, so
        // they are part of this transaction.
        await raw.transaction(async () => {
          result = await fn(orm);
        });
        return result!;
      });
    },
    async exec(sql, params) {
      const res = await raw.execute(sql, params as never);
      return res.rows ?? [];
    },
    onChange(tables, listener) {
      // Native change tracking: fires once per commit that touched a table.
      // The query itself is a no-op; readers re-run their own Drizzle query.
      return raw.reactiveExecute({
        query: "SELECT 1",
        arguments: [],
        fireOn: tables.map((table) => ({ table })),
        callback: () => listener(),
      });
    },
    async close() {
      raw.close();
    },
  };
}

/** SQLCipher's raw-key form for a hex key. */
export const rawKey = (hex: string) => `x'${hex}'`;
