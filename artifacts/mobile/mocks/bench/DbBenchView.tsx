import { COLD_START_MARK } from "@/constants/Config";
import { seedBench } from "@/db/bench/Seed";
import { closeUserDatabase, openUserDatabase } from "@/db/Current";
import { useKeysetWindow } from "@/db/LiveQuery";
import { captures, TABLES } from "@/db/schema";
import { endMark, recordTiming, setDbTiming, timingReport } from "@/db/Timing";
import { saveCaptureEdit } from "@/services/storage/CaptureStore";
import {
  captureCounts,
  captureListQuery,
} from "@/services/storage/repos/CaptureRepo";
import type { CaptureSummary } from "@/types/Capture";
import { sql } from "drizzle-orm";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";

/*
 * Dev-only storage benchmark on a real device (op-sqlite + SQLCipher), run
 * from `mobile://dev-bench?n=50000`. Results go to the screen and to the log
 * as one `DBBENCH_RESULT {json}` line (adb logcat -s ReactNativeJS). Part of
 * the dev mocks bundle only (see mocks/index.ts), never a release build.
 */

const BENCH_USER = "bench-storage";
const TABLES_READ = [TABLES.captures] as const;
const ROW_HEIGHT = 64;
const SCROLL_MS = 6_000;
const EDITS = 30;

type Phase =
  "seeding" | "cold" | "scroll-db" | "scroll-memory" | "edit" | "done";

const tick = () => new Promise<number>((r) => requestAnimationFrame(r));
const clock = () => performance.now();

function frameStats(deltas: number[]) {
  const sorted = [...deltas].sort((a, b) => a - b);
  return {
    frames: sorted.length,
    over16: sorted.filter((d) => d > 16.7).length,
    p50: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function Row({ item }: { item: CaptureSummary }) {
  return (
    <View className="h-16 px-4 justify-center border-b border-border bg-surface">
      <Text className="type-body-strong text-text">{item.title}</Text>
      <Text className="type-caption text-text-muted">
        {item.id} · {item.syncStatus}
      </Text>
    </View>
  );
}

/** Scrolls a list by script for SCROLL_MS, measuring JS frame intervals. */
async function scrollAndMeasure(list: FlatList | null, loadMore?: () => void) {
  const deltas: number[] = [];
  const start = clock();
  let last = await tick();
  let offset = 0;
  while (clock() - start < SCROLL_MS) {
    offset += 40; // ~2,400 px/s: a brisk fling
    list?.scrollToOffset({ offset, animated: false });
    loadMore?.();
    const t = await tick();
    deltas.push(t - last);
    last = t;
  }
  return frameStats(deltas);
}

export function DbBenchView() {
  const params = useLocalSearchParams<{ n?: string }>();
  const n = Number(params.n ?? 50_000);
  const [phase, setPhase] = useState<Phase>("seeding");
  const [log, setLog] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [memoryRows, setMemoryRows] = useState<CaptureSummary[] | null>(null);
  const results = useRef<Record<string, unknown>>({});
  const list = useRef<FlatList>(null);
  const say = (line: string) => {
    console.log(`[dbbench] ${line}`);
    setLog((l) => [...l.slice(-12), line]);
  };

  const records = useKeysetWindow(
    TABLES_READ,
    captureListQuery("mine", "all", ""),
    [ready],
    50,
    "bench.records",
  );

  // The first page painted after the (re)open: cold start to first list.
  const coldStart = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || !records.loaded || coldStart.current === null) return;
    requestAnimationFrame(() => {
      const ms = clock() - coldStart.current!;
      coldStart.current = null;
      recordTiming("bench.open→first painted list", ms);
      endMark(COLD_START_MARK);
      results.current.coldOpenToFirstPaintMs = ms;
      say(`open → first painted list: ${ms.toFixed(1)} ms`);
    });
  }, [ready, records.loaded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDbTiming(true);
      // 1. Seed once (kept across runs).
      let db = await openUserDatabase(BENCH_USER);
      const [{ count }] = await db.orm
        .select({ count: sql<number>`count(*)` })
        .from(captures);
      if (Number(count) < n) {
        say(`seeding ${n - Number(count)} rows…`);
        const t = clock();
        await seedBench(db, n, {
          onProgress: (done) => done % 10_000 === 0 && say(`seeded ${done}`),
        });
        say(`seeded in ${((clock() - t) / 1000).toFixed(1)} s`);
      }
      await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

      // 2. Cold open: close, then time key fetch + open + migrate check + first page.
      setPhase("cold");
      await closeUserDatabase();
      coldStart.current = clock();
      db = await openUserDatabase(BENCH_USER);
      const t = clock();
      await captureCounts(db.orm, "mine");
      results.current.countsMs = clock() - t;
      setReady(true);
      while (!cancelled && coldStart.current !== null) await tick();

      // 3. Scroll the DB-backed keyset list, then the same rows from memory.
      await new Promise((r) => setTimeout(r, 1_000));
      setPhase("scroll-db");
      results.current.scrollDb = await scrollAndMeasure(list.current, () =>
        loadMoreRef.current(),
      );
      say(`scroll (SQLite pages): ${JSON.stringify(results.current.scrollDb)}`);
      setMemoryRows(windowRowsRef.current);
      setPhase("scroll-memory");
      await new Promise((r) => setTimeout(r, 500));
      results.current.scrollMemory = await scrollAndMeasure(list.current);
      say(
        `scroll (in-memory baseline): ${JSON.stringify(results.current.scrollMemory)}`,
      );
      setMemoryRows(null);

      // 4. Single record edits, call to committed.
      setPhase("edit");
      const edits: number[] = [];
      for (let i = 0; i < EDITS; i++) {
        const id = `bench-${String((i * 1_663) % n).padStart(6, "0")}`;
        const t0 = clock();
        await saveCaptureEdit(id, {
          category: "energy",
          statuses: i % 2 ? ["cracked"] : ["good"],
          suggested: [],
          functional: "yes",
          comment: `bench edit ${i}`,
          duplicate: null,
          duplicateChoice: null,
        });
        edits.push(clock() - t0);
        await tick();
      }
      results.current.edit = frameStats(edits);
      say(`edit → committed: ${JSON.stringify(results.current.edit)}`);

      results.current.timings = timingReport();
      results.current.n = n;
      console.log(`DBBENCH_RESULT ${JSON.stringify(results.current)}`);
      setPhase("done");
    })().catch((err) => say(`failed: ${String(err?.stack ?? err)}`));
    return () => {
      cancelled = true;
    };
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMoreRef = useRef(records.loadMore);
  loadMoreRef.current = records.loadMore;
  const windowRowsRef = useRef(records.rows);
  windowRowsRef.current = records.rows;

  return (
    <View className="flex-1 bg-background pt-safe">
      <View className="p-4 gap-1 border-b border-border">
        <Text className="type-title text-text">
          Storage benchmark · {n.toLocaleString()} rows · {phase}
        </Text>
        <Text className="type-caption text-text-muted">
          In window: {records.rows.length} rows
        </Text>
        {log.map((line, i) => (
          <Text key={i} className="type-mono text-text">
            {line}
          </Text>
        ))}
      </View>
      <FlatList
        ref={list}
        data={memoryRows ?? records.rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <Row item={item} />}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        onEndReached={memoryRows ? undefined : records.loadMore}
        onEndReachedThreshold={2}
        windowSize={11}
      />
    </View>
  );
}
