import type { Database } from "../Database";
import { migrate } from "../Migrate";
import { createProxyDatabase } from "../ProxyDatabase";

/* Test-only: never imported by app code, so Metro never bundles it. */

type NodeValue = null | number | bigint | string | Uint8Array;

const toNode = (params: unknown[]): NodeValue[] =>
  params.map((p) =>
    p === undefined
      ? null
      : typeof p === "boolean"
        ? Number(p)
        : (p as NodeValue),
  );

/**
 * A `Database` on Node's built-in SQLite, file-backed or `:memory:`, with the
 * app's migrations applied. The same Drizzle schema and queries as the
 * device; only the driver differs.
 */
export async function openNodeDatabase(
  path = ":memory:",
  { migrated = true }: { migrated?: boolean } = {},
): Promise<Database> {
  const { DatabaseSync } = require("node:sqlite");
  const raw = new DatabaseSync(path);
  if (path !== ":memory:") raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA synchronous = NORMAL");

  const db = createProxyDatabase({
    async query(sql, params) {
      const stmt = raw.prepare(sql);
      stmt.setReturnArrays(true);
      return stmt.all(...toNode(params));
    },
    async queryObjects(sql, params) {
      return raw.prepare(sql).all(...toNode(params));
    },
    async run(sql, params) {
      if (params.length) raw.prepare(sql).run(...toNode(params));
      else raw.exec(sql);
    },
    async close() {
      if (raw.isOpen) raw.close();
    },
  });
  if (migrated) await migrate(db);
  return db;
}
