import { captures, outbox } from "@/db/schema";
import {
  captureRow,
  captureCounts,
  captureListQuery,
  upsertOwnCaptures,
} from "@/services/storage/repos/CaptureRepo";
import { saveObservations } from "@/services/storage/repos/ObservationRepo";
import { eq } from "drizzle-orm";
import { openDatabase } from "../Client";
import { migrate } from "../Migrate";

/**
 * op-sqlite is native; this stands in for its v18 JS API (functions.ts) on
 * node:sqlite, with the same result shapes: `execute` → `{ rows }`, and
 * `executeRaw` / `executeRawAsync` → `{ rawRows, columnNames }`. The app's
 * real `drizzle-orm/op-sqlite` driver runs on top of it, so a shape mismatch
 * between the two libraries fails here, not on a phone.
 */
jest.mock("@op-engineering/op-sqlite", () => {
  const { DatabaseSync } = jest.requireActual("node:sqlite");
  const toNode = (params: unknown[] = []) =>
    params.map((p) =>
      p === undefined ? null : typeof p === "boolean" ? Number(p) : p,
    );
  return {
    open: () => {
      const db = new DatabaseSync(":memory:");
      const executeSync = (sql: string, params?: unknown[]) => {
        const stmt = db.prepare(sql);
        if (stmt.columns().length === 0) {
          const r = stmt.run(...toNode(params));
          return { rows: [], rowsAffected: Number(r.changes) };
        }
        return { rows: stmt.all(...toNode(params)), rowsAffected: 0 };
      };
      const executeRaw = async (sql: string, params?: unknown[]) => {
        const stmt = db.prepare(sql);
        if (stmt.columns().length === 0) {
          stmt.run(...toNode(params));
          return { rawRows: [], columnNames: [], rowsAffected: 0 };
        }
        stmt.setReturnArrays(true);
        return {
          rawRows: stmt.all(...toNode(params)),
          columnNames: stmt.columns().map((c: { name: string }) => c.name),
          rowsAffected: 0,
        };
      };
      return {
        execute: async (sql: string, params?: unknown[]) =>
          executeSync(sql, params),
        executeAsync: async (sql: string, params?: unknown[]) =>
          executeSync(sql, params),
        executeSync,
        executeRaw,
        // v18 keeps this alias for Drizzle, with executeRaw's object shape.
        executeRawAsync: executeRaw,
        transaction: async (fn: (tx: unknown) => Promise<void>) => {
          db.exec("BEGIN TRANSACTION;");
          try {
            await fn({});
            db.exec("COMMIT;");
          } catch (err) {
            db.exec("ROLLBACK;");
            throw err;
          }
        },
        reactiveExecute: () => () => undefined,
        close: () => db.close(),
      };
    },
  };
});

const summary = (id: string, capturedAt: string) => ({
  id,
  category: "energy" as const,
  title: "Concrete pole",
  capturedAt,
  accuracyM: 2.8,
  syncStatus: "pending" as const,
  flagged: false,
});

describe("openDatabase (op-sqlite driver)", () => {
  it("migrates, writes in a transaction and reads typed rows through Drizzle", async () => {
    const db = await openDatabase({ name: "t.db" });
    await migrate(db);

    await db.write(async (tx) => {
      await upsertOwnCaptures(tx, [
        captureRow(summary("a", "2026-09-24T09:00:00.000Z"), null, "mine", 1),
        captureRow(summary("b", "2026-09-25T09:00:00.000Z"), null, "mine", 1),
      ]);
      await saveObservations(tx, [{ pid: "a", latitude: 1, longitude: 2 }], {
        deviceId: "dev",
        now: 1,
        captureId: "a",
      });
    });

    // Typed selects: JSON columns decoded, booleans mapped, order kept.
    const page = await captureListQuery("mine", "all", "").page(
      db.orm,
      null,
      10,
    );
    expect(page.map((s) => s.id)).toEqual(["b", "a"]);
    expect(await captureCounts(db.orm, "mine")).toMatchObject({
      all: 2,
      pending: 2,
    });
    const [row] = await db.orm
      .select()
      .from(captures)
      .where(eq(captures.id, "a"));
    expect(row).toMatchObject({
      flagged: false,
      summary: { title: "Concrete pole" },
    });
    expect(await db.orm.select().from(outbox)).toHaveLength(1);
    await db.close();
  });

  it("rolls the whole write back when it fails", async () => {
    const db = await openDatabase({ name: "t.db" });
    await migrate(db);
    await expect(
      db.write(async (tx) => {
        await upsertOwnCaptures(tx, [
          captureRow(summary("a", "2026-09-24T09:00:00.000Z"), null, "mine", 1),
        ]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.orm.select().from(captures)).toEqual([]);
    await db.close();
  });
});
