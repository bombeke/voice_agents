/**
 * @jest-environment node
 */
import { observations, outbox, syncState } from "@/db/schema";
import { fakeChangeFeed, remotePid } from "@/db/testing/fakeChanges";
import { openNodeDatabase } from "@/db/testing/NodeDatabase";
import { saveObservations } from "@/services/storage/repos/ObservationRepo";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  OBSERVATIONS_COLLECTION,
  pullObservations,
  readCursor,
} from "../PullSync";

const ROOT = resolve(__dirname, "../../..");
const TOTAL = 2_600; // six pages: five full and a partial one
const BATCH = 500;
const KILL_AT_PAGE = 2; // pages 0 and 1 commit; page 2 dies inside its transaction
/** Pulled on page 0, and edited locally beforehand: a real conflict. */
const CONFLICTED = remotePid(10);

let dir: string;
let childJs: string;

/** Bundles the child with the app's own sources (the `@/` alias, the .sql migrations). */
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "pull-kill-"));
  childJs = join(dir, "child.js");
  const esbuild = require("esbuild");
  await esbuild.build({
    entryPoints: [join(ROOT, "db/testing/pullChild.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: childJs,
    external: ["node:sqlite"],
    loader: { ".sql": "text" },
    alias: {
      "@": ROOT,
      "expo-crypto": join(ROOT, "db/testing/expoCryptoShim.js"),
    },
    logLevel: "silent",
  });
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Runs the child until it is inside page KILL_AT_PAGE's transaction, then SIGKILLs it. */
function runAndKill(
  dbPath: string,
): Promise<{ signal: NodeJS.Signals | null; out: string }> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [
      "--no-warnings",
      childJs,
      dbPath,
      String(TOTAL),
      String(BATCH),
      String(KILL_AT_PAGE),
    ]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d;
      if (out.includes(`IN_TX ${KILL_AT_PAGE}`)) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", fail);
    child.on("exit", (_code, signal) => {
      if (signal !== "SIGKILL")
        fail(new Error(`child was not killed: ${out}\n${err}`));
      else done({ signal, out });
    });
  });
}

it("leaves a consistent database and a replayable cursor when killed mid-sync", async () => {
  const dbPath = join(dir, "user.db");

  // A local, unsent edit of a record the server is about to send (concurrent clocks).
  const seed = await openNodeDatabase(dbPath);
  await seed.write((tx) =>
    saveObservations(
      tx,
      [
        {
          pid: CONFLICTED,
          latitude: 0.3,
          longitude: 32.5,
          comment: "edited offline",
          category: "energy",
        },
      ],
      { deviceId: "dev-child", now: 1_790_000_000_000 },
    ),
  );
  await seed.close();

  const { out } = await runAndKill(dbPath);
  expect(out).toContain(`IN_TX ${KILL_AT_PAGE}`);
  expect(out).not.toContain("DONE");
  // The kill left uncommitted frames behind in the WAL.
  expect(readFileSync(`${dbPath}-wal`).length).toBeGreaterThan(0);

  // Reopen after the crash: SQLite recovers from the WAL.
  const db = await openNodeDatabase(dbPath);
  expect(await db.exec("PRAGMA integrity_check")).toEqual([
    { integrity_check: "ok" },
  ]);
  expect(await db.exec("PRAGMA foreign_key_check")).toEqual([]);

  // Exactly the committed pages, and a cursor that points right after them.
  const committed = KILL_AT_PAGE * BATCH;
  const [{ n }] = await db.orm
    .select({ n: sql<number>`count(*)` })
    .from(observations);
  expect(Number(n)).toBe(committed); // the conflicted record is one of them
  expect(await readCursor(db.orm)).toBe(String(committed));
  const partial = await db.orm
    .select({ pid: observations.pid })
    .from(observations)
    .where(gte(observations.pid, remotePid(committed)));
  expect(partial).toEqual([]);

  // The conflict resolved in page 0's transaction: merged, with one upload queued.
  const [merged] = await db.orm
    .select()
    .from(observations)
    .where(eq(observations.pid, CONFLICTED));
  expect(merged.data).toMatchObject({
    comment: "edited offline",
    deviceId: "dev-child",
  });
  expect(merged.vc).toMatchObject({ "dev-server": 1, "dev-child": 2 });
  const queued = await db.orm
    .select()
    .from(outbox)
    .where(
      and(eq(outbox.entity, "observation"), eq(outbox.entityId, CONFLICTED)),
    );
  expect(queued).toHaveLength(1);
  expect(queued[0].payload).toMatchObject({ comment: "edited offline" });

  // Replay from the stored cursor: only the missing pages come down.
  const fetchPage = jest.fn(fakeChangeFeed(TOTAL));
  const replay = await pullObservations({
    db,
    fetchPage,
    deviceId: "dev-child",
    batchSize: BATCH,
  });
  expect(fetchPage.mock.calls[0][0]).toBe(String(committed));
  expect(replay.pages).toBe(Math.ceil((TOTAL - committed) / BATCH));
  const [{ total }] = await db.orm
    .select({ total: sql<number>`count(*)` })
    .from(observations);
  expect(Number(total)).toBe(TOTAL);
  const [state] = await db.orm
    .select()
    .from(syncState)
    .where(eq(syncState.collection, OBSERVATIONS_COLLECTION));
  expect(state).toMatchObject({ serverCursor: String(TOTAL) });
  expect(state.lastSyncedAt).not.toBeNull();

  // Nothing left to pull: another run changes nothing.
  const again = await pullObservations({
    db,
    fetchPage: fakeChangeFeed(TOTAL),
    deviceId: "dev-child",
    batchSize: BATCH,
  });
  expect(again.applied).toBe(0);
  await db.close();
}, 60_000);

it("never fetches or loads a whole table: every request asks for one batch", async () => {
  const db = await openNodeDatabase(join(dir, "batches.db"));
  const fetchPage = jest.fn(fakeChangeFeed(1_234));
  await pullObservations({ db, fetchPage, deviceId: "d", batchSize: BATCH });
  expect(fetchPage.mock.calls.map(([, limit]) => limit)).toEqual([
    BATCH,
    BATCH,
    BATCH,
  ]);
  await db.close();
});
