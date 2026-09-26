import bundled from "@/drizzle/migrations";
import type { Database } from "./Database";
import { timed } from "./Timing";

export interface MigrationBundle {
  journal: { entries: { idx: number; when: number; tag: string }[] };
  migrations: Record<string, string>;
}

const TABLE = "__drizzle_migrations";

/**
 * Applies drizzle-kit's migrations (drizzle/), forward only, each in its own
 * transaction together with its bookkeeping row. Uses Drizzle's own table and
 * ordering (`created_at` = the journal's `when`), so drizzle-kit agrees on
 * what has run. Drizzle's op-sqlite migrator isn't used: its transaction
 * doesn't await the statements.
 */
export async function migrate(
  db: Database,
  bundle: MigrationBundle = bundled as MigrationBundle,
): Promise<number> {
  return timed("migrate", async () => {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    const [last] = await db.exec(
      `SELECT created_at FROM ${TABLE} ORDER BY created_at DESC LIMIT 1`,
    );
    const lastRun = last ? Number(last.created_at) : -1;

    const pending = [...bundle.journal.entries]
      .sort((a, b) => a.when - b.when)
      .filter((e) => e.when > lastRun);

    for (const entry of pending) {
      const key = `m${String(entry.idx).padStart(4, "0")}`;
      const source = bundle.migrations[key];
      if (source === undefined)
        throw new Error(`Missing migration ${entry.tag}`);
      const statements = source
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      await db.write(async () => {
        for (const stmt of statements) await db.exec(stmt);
        await db.exec(`INSERT INTO ${TABLE} (hash, created_at) VALUES (?, ?)`, [
          entry.tag,
          entry.when,
        ]);
      });
    }
    return pending.length;
  });
}
