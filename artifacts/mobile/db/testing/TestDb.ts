import {
  captureRow,
  upsertOwnCaptures,
} from "@/services/storage/repos/CaptureRepo";
import type { CaptureRecord, CaptureSummary } from "@/types/Capture";
import { setDatabase } from "../Current";
import type { Database } from "../Database";
import type { RecordScope } from "../schema";
import { openNodeDatabase } from "./NodeDatabase";

/* Test-only helpers; app code never imports this folder. */

/**
 * A fresh, migrated in-memory database installed as the signed-in user's,
 * for each test. Use the returned getter inside tests.
 */
export function setupTestDatabase(): () => Database {
  let db: Database | null = null;
  beforeEach(async () => {
    db = await openNodeDatabase();
    setDatabase(db);
  });
  afterEach(async () => {
    setDatabase(null);
    await db?.close();
    db = null;
  });
  return () => {
    if (!db) throw new Error("setupTestDatabase: no database outside a test");
    return db;
  };
}

/** Lets pending promise callbacks (live-query results) run. */
export const flushPromises = () => new Promise((r) => setImmediate(r));

/** Stores Records rows (with optional detail records) as the app would. */
export async function seedCaptures(
  db: Database,
  summaries: readonly CaptureSummary[],
  {
    scope = "mine",
    records = {},
  }: { scope?: RecordScope; records?: Record<string, CaptureRecord> } = {},
) {
  await db.write((tx) =>
    upsertOwnCaptures(
      tx,
      summaries.map((s) => captureRow(s, records[s.id] ?? null, scope, 0)),
    ),
  );
}
