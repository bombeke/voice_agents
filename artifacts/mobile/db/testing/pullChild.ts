/*
 * Test-only child process for the kill test (see
 * services/sync/__tests__/PullSync.kill.test.ts). Pulls from a fake change
 * feed into a file database, printing each commit, and spins inside the
 * transaction of page `killAt` so the parent can SIGKILL it there.
 */
import { pullObservations } from "@/services/sync/PullSync";
import { fakeChangeFeed } from "./fakeChanges";
import { openNodeDatabase } from "./NodeDatabase";

async function main() {
  const [path, total, batch, killAt] = process.argv.slice(2);
  const db = await openNodeDatabase(path);
  // A tiny page cache makes SQLite spill uncommitted pages into the WAL file,
  // so the kill leaves real half-written frames on disk for recovery.
  await db.exec("PRAGMA cache_size = 8");
  await pullObservations({
    db,
    fetchPage: fakeChangeFeed(Number(total)),
    deviceId: "dev-child",
    batchSize: Number(batch),
    beforeCommit: (page) => {
      if (page === Number(killAt)) {
        process.stdout.write(`IN_TX ${page}\n`);
        // Hold the transaction open (writes done, no COMMIT) until killed.
        const until = Date.now() + 30_000;
        while (Date.now() < until) {
          /* spin */
        }
      }
    },
  });
  process.stdout.write("DONE\n");
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err));
  process.exit(1);
});
