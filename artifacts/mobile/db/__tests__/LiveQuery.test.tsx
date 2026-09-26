import { captures, syncState } from "@/db/schema";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { sql } from "drizzle-orm";
import { setDatabase } from "../Current";
import { liveQuery, useLiveQuery } from "../LiveQuery";
import { openNodeDatabase } from "../testing/NodeDatabase";
import { flushPromises, setupTestDatabase } from "../testing/TestDb";

const getDb = setupTestDatabase();
const count = (table: typeof syncState | typeof captures) => async (orm: any) =>
  Number((await orm.select({ n: sql<number>`count(*)` }).from(table))[0].n);

it("re-runs after commits to its tables only, and stops when unsubscribed", async () => {
  const seen: number[] = [];
  const off = liveQuery(["sync_state"], count(syncState), (n) => seen.push(n));
  await flushPromises();
  await getDb().write((tx) => tx.insert(syncState).values({ collection: "a" }));
  await flushPromises();
  // A commit to another table doesn't re-run it.
  await getDb().write((tx) =>
    tx.run(sql`UPDATE captures SET flagged = 0 WHERE 0`),
  );
  await flushPromises();
  off();
  await getDb().write((tx) => tx.insert(syncState).values({ collection: "b" }));
  await flushPromises();
  expect(seen).toEqual([0, 1]);
});

it("drops a slow older result once a newer run has started", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let calls = 0;
  const seen: string[] = [];
  const handle = liveQuery(
    ["sync_state"],
    async () => {
      const mine = ++calls;
      if (mine === 1) await gate;
      return `run-${mine}`;
    },
    (v) => seen.push(v),
  );
  handle.refresh();
  await flushPromises();
  release();
  await flushPromises();
  expect(seen).toEqual(["run-2"]);
  handle();
});

it("switches to another user's database", async () => {
  const other = await openNodeDatabase();
  await other.write((tx) =>
    tx.insert(syncState).values([{ collection: "x" }, { collection: "y" }]),
  );
  const { result } = await renderHook(() =>
    useLiveQuery(["sync_state"], count(syncState), [], -1),
  );
  await waitFor(() => expect(result.current).toBe(0));
  await act(async () => setDatabase(other, "other-user"));
  await waitFor(() => expect(result.current).toBe(2));
  await other.close();
});
