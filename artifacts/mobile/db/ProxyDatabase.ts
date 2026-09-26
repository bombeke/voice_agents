import { drizzle } from "drizzle-orm/sqlite-proxy";
import { ChangeBus, createLock, type Database, type Orm } from "./Database";
import * as schema from "./schema";
import { timed } from "./Timing";

/** The few calls a SQLite connection has to offer for `createProxyDatabase`. */
export interface SqlDriver {
  /** Rows as value arrays, in column order. */
  query(sql: string, params: unknown[]): Promise<unknown[][]>;
  /** Same query, rows keyed by column name. */
  queryObjects(
    sql: string,
    params: unknown[],
  ): Promise<Record<string, unknown>[]>;
  run(sql: string, params: unknown[]): Promise<void>;
  close(): Promise<void>;
}

/**
 * A `Database` over any SQL connection through Drizzle's proxy driver: the
 * web backend and the node:sqlite one tests use. Transactions are plain
 * BEGIN/COMMIT behind a lock, and change notification comes from the write
 * statements themselves.
 */
export function createProxyDatabase(driver: SqlDriver): Database {
  const bus = new ChangeBus();
  const withLock = createLock();

  const orm = drizzle(
    async (sql, params, method) => {
      if (method === "run") {
        bus.track(sql);
        await driver.run(sql, params);
        return { rows: [] };
      }
      const rows = await driver.query(sql, params);
      return { rows: method === "get" ? (rows[0] ?? []) : rows };
    },
    { schema },
  ) as unknown as Orm;

  return {
    orm,
    write<T>(fn: (tx: Orm) => Promise<T>) {
      return timed("write", () =>
        withLock(async () => {
          await driver.run("BEGIN IMMEDIATE", []);
          try {
            const result = await fn(orm);
            await driver.run("COMMIT", []);
            bus.flush();
            return result;
          } catch (err) {
            bus.discard();
            await driver.run("ROLLBACK", []).catch(() => undefined);
            throw err;
          }
        }),
      );
    },
    exec(sql, params = []) {
      bus.track(sql);
      return driver.queryObjects(sql, params);
    },
    onChange(tables, listener) {
      return bus.subscribe(tables, listener);
    },
    close() {
      return driver.close();
    },
  };
}
