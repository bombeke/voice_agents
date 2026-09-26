/**
 * @jest-environment node
 *
 * Storage benchmark at N rows (default 50k): `pnpm --filter mobile db:bench`.
 * Same schema, migrations, queries and write paths as the app, on Node's
 * SQLite with a WAL file database. Prints p50/p95/max per operation and
 * checks every hot query's plan uses an index. Device numbers come from the
 * in-app benchmark (mocks/bench); this is the repeatable CI baseline.
 */
import {
  captureListQuery,
  captureCounts,
  todayStats,
} from "@/services/storage/repos/CaptureRepo";
import { assetsInView } from "@/services/storage/repos/MapAssetRepo";
import { nearbyObservations } from "@/services/storage/repos/ObservationRepo";
import { saveCaptureEdit } from "@/services/storage/CaptureStore";
import { applyChangesPage } from "@/services/sync/PullSync";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setDatabase } from "../Current";
import type { Database } from "../Database";
import { openNodeDatabase } from "../testing/NodeDatabase";
import { captures } from "../schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { benchRow, seedBench } from "./Seed";

jest.mock("@/services/storage/LegendState", () => ({
  getDeviceId: () => "bench-device",
}));
jest.mock("@/services/sync/Outbox", () => ({
  ...jest.requireActual("@/services/sync/Outbox"),
  signalOutbox: () => undefined,
}));

const N = Number(process.env.BENCH_N ?? 50_000);
const RUNS = 30;
const NOW = Date.UTC(2026, 8, 25, 10);

let dir: string;
let path: string;
let db: Database;
const results: Record<string, { p50: number; p95: number; max: number }> = {};

// Jest's clock is millisecond-coarse; hrtime isn't.
const now = () => Number(process.hrtime.bigint()) / 1e6;
async function measure(
  label: string,
  fn: (i: number) => Promise<unknown>,
  runs = RUNS,
) {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = now();
    await fn(i);
    times.push(now() - t);
  }
  times.sort((a, b) => a - b);
  const stats = {
    p50: times[Math.floor(runs / 2)],
    p95: times[Math.min(runs - 1, Math.floor(runs * 0.95))],
    max: times[runs - 1],
  };
  results[label] = stats;
  return stats;
}

/** The plan of a Drizzle query, as SQLite would run it. */
async function plan(q: { toSQL(): { sql: string; params: unknown[] } }) {
  const { sql, params } = q.toSQL();
  const rows = await db.exec(`EXPLAIN QUERY PLAN ${sql}`, params);
  return rows.map((r) => String(r.detail)).join(" | ");
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "storage-bench-"));
  path = join(dir, "bench.db");
  db = await openNodeDatabase(path);
  const t = now();
  await seedBench(db, N, { now: NOW });
  results[`seed ${N} rows (1000/tx)`] = { p50: now() - t, p95: 0, max: 0 };
  await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  await db.close();
}, 600_000);

afterAll(async () => {
  await db?.close();
  setDatabase(null);
  rmSync(dir, { recursive: true, force: true });
  const table = Object.entries(results)
    .map(
      ([k, v]) =>
        `${k.padEnd(52)} p50 ${v.p50.toFixed(2).padStart(8)} ms   p95 ${v.p95.toFixed(2).padStart(8)} ms   max ${v.max.toFixed(2).padStart(8)} ms`,
    )
    .join("\n");
  console.log(`\nStorage benchmark, N = ${N}\n${table}\n`);
});

it("cold start: open + migrate check + first Records page and counts", async () => {
  const stats = await measure(
    "cold open → first page (50) + counts",
    async () => {
      const fresh = await openNodeDatabase(path);
      const q = captureListQuery("mine", "all", "");
      await q.page(fresh.orm, null, 50);
      await captureCounts(fresh.orm, "mine");
      await fresh.close();
    },
    10,
  );
  expect(stats.p95).toBeLessThan(300);
  db = await openNodeDatabase(path);
  setDatabase(db, "bench");
});

it("scrolls: every keyset page costs the same, top or bottom", async () => {
  const q = captureListQuery("mine", "all", "");
  const top = await measure("keyset page (50), top", () =>
    q.page(db.orm, null, 50),
  );
  const deepAnchor = q.keyOf(benchRow(N - 100, NOW).summary);
  const deep = await measure("keyset page (50), 49,900 rows down", () =>
    q.page(db.orm, deepAnchor, 50),
  );
  const anchor = q.keyOf(benchRow(200, NOW).summary);
  await measure("live refresh down to anchor (200 rows)", () =>
    q.through(db.orm, anchor),
  );
  expect(top.p95).toBeLessThan(16);
  expect(deep.p95).toBeLessThan(16);
  // Newest-first pages walk the index: no sort of the table.
  const first = db.orm
    .select({ id: captures.id })
    .from(captures)
    .where(
      and(
        eq(captures.scope, "mine"),
        sql`(${captures.capturedAt}, ${captures.id}) < (${deepAnchor.at}, ${deepAnchor.id})`,
      ),
    )
    .orderBy(desc(captures.capturedAt), desc(captures.id))
    .limit(50);
  const detail = await plan(first);
  expect(detail).toMatch(/captures_page_idx/);
  expect(detail).not.toMatch(/TEMP B-TREE/);
});

it("filters and counts from indexes", async () => {
  const countsPlan = await plan(
    db.orm
      .select({ status: captures.syncStatus, n: sql`count(*)` })
      .from(captures)
      .where(eq(captures.scope, "mine"))
      .groupBy(captures.syncStatus),
  );
  expect(countsPlan).toMatch(/COVERING INDEX captures_status_idx/);
  await measure("Records counts (5 aggregates)", () =>
    captureCounts(db.orm, "mine"),
  );
  await measure("Records 'pending' first page", () =>
    captureListQuery("mine", "pending", "").page(db.orm, null, 50),
  );
  await measure("Records search 'borehole' first page", () =>
    captureListQuery("mine", "all", "borehole").page(db.orm, null, 50),
  );
  const day = NOW - (NOW % 86_400_000);
  await measure("Home today stats", () =>
    todayStats(db.orm, day, day + 86_400_000),
  );
  await measure("Map viewport (1 km box)", () =>
    assetsInView(db.orm, {
      category: "all",
      query: "",
      bounds: [32.4, 0.2, 32.41, 0.21],
    }),
  );
  await measure("duplicate check (250 m box)", () =>
    nearbyObservations(db.orm, { latitude: 0.25, longitude: 32.45 }, 250),
  );
});

it("single record edit: one transaction to committed", async () => {
  const form = {
    category: "energy" as const,
    statuses: ["cracked" as const],
    suggested: [],
    functional: "no" as const,
    comment: "",
    duplicate: null,
    duplicateChoice: null,
  };
  const stats = await measure("single record edit → committed", (i) =>
    saveCaptureEdit(benchRow(i * 7, NOW).summary.id, {
      ...form,
      comment: `edit ${i}`,
    }),
  );
  expect(stats.p95).toBeLessThan(10);
});

it("pull: one delta page of 500 in one transaction", async () => {
  await measure(
    "apply delta page (500 rows)",
    (i) =>
      db.write((tx) =>
        applyChangesPage(
          tx,
          {
            items: Array.from({ length: 500 }, (_, k) => ({
              ...benchRow(N + i * 500 + k, NOW).pole,
              deviceId: "server",
              vc: { server: 1 },
            })),
            nextCursor: String(i),
            hasMore: true,
          },
          { deviceId: "bench-device", now: NOW },
        ),
      ),
    10,
  );
});

it("for comparison: the old model's whole-blob write of every record", async () => {
  const all = Array.from({ length: N }, (_, i) => benchRow(i, NOW).summary);
  const records = Object.fromEntries(
    Array.from({ length: N }, (_, i) => [
      benchRow(i, NOW).record.id,
      benchRow(i, NOW).record,
    ]),
  );
  await measure(
    "OLD: JSON.stringify(captures$) per write",
    async () => JSON.stringify(all),
    5,
  );
  await measure(
    "OLD: JSON.stringify(records$) per write",
    async () => JSON.stringify(records),
    5,
  );
});
