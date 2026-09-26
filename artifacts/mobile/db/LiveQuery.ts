import type { Observable } from "@legendapp/state";
import { useObservable, useSelector } from "@legendapp/state/react";
import { useCallback, useEffect, useRef } from "react";
import { dbEpoch$, peekDb } from "./Current";
import type { Orm } from "./Database";
import type { TableName } from "./schema";
import { timed } from "./Timing";

/**
 * Runs `run` against the open database now and again after every commit that
 * touches `tables`, handing each result to `onResult`. Results never arrive
 * out of order: a slow older run is dropped once a newer one has started.
 * Returns the unsubscribe, which can also `refresh()` by hand.
 */
export function liveQuery<T>(
  tables: readonly TableName[],
  run: (orm: Orm) => Promise<T>,
  onResult: (value: T) => void,
  label = "query",
): LiveQueryHandle {
  const db = peekDb();
  if (!db) return Object.assign(() => undefined, { refresh: () => undefined });
  let seq = 0;
  let disposed = false;
  const refresh = () => {
    const mine = ++seq;
    timed(label, () => run(db.orm))
      .then((value) => {
        if (!disposed && mine === seq) onResult(value);
      })
      .catch((err) => {
        if (!disposed) console.warn(`[db] ${label} failed`, err);
      });
  };
  const off = db.onChange(tables, refresh);
  refresh();
  return Object.assign(
    () => {
      disposed = true;
      off();
    },
    { refresh },
  );
}

export type LiveQueryHandle = (() => void) & { refresh: () => void };

/**
 * A live query as React state: a screen-local observable that holds only
 * this query's result, re-run on commits to `tables`, on a change of `deps`,
 * and when another user's database opens. `initial` is shown until the first
 * result (and when no database is open).
 */
export function useLiveQuery<T>(
  tables: readonly TableName[],
  run: (orm: Orm) => Promise<T>,
  deps: readonly unknown[],
  initial: T,
  label?: string,
): T {
  // Legend's generic unwrapping can't see through an unconstrained T. `seq`
  // makes every result a change: Legend treats undefined → null as none,
  // and "not found" (null) must replace "loading" (undefined).
  const value$ = useObservable({
    value: initial,
    seq: 0,
  }) as unknown as Observable<{
    value: unknown;
    seq: number;
  }>;
  const epoch = useSelector(dbEpoch$);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!peekDb()) value$.set((b) => ({ value: initial, seq: b.seq + 1 }));
    return liveQuery(
      tables,
      (orm) => runRef.current(orm),
      (value) => value$.set((b) => ({ value, seq: b.seq + 1 })),
      label,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, tables.join(","), ...deps]);

  useSelector(() => value$.seq.get());
  return value$.value.peek() as T;
}

/** Position in a newest-first list: (time, id) of a row. */
export interface Keyset {
  at: number;
  id: string;
}

export interface KeysetQuery<T> {
  /** Up to `limit` rows strictly after `after` (null: from the top), newest first. */
  page(orm: Orm, after: Keyset | null, limit: number): Promise<T[]>;
  /** Every row from the top down to and including `anchor`. */
  through(orm: Orm, anchor: Keyset): Promise<T[]>;
  keyOf(row: T): Keyset;
}

interface WindowState<T> {
  rows: T[];
  hasMore: boolean;
  loaded: boolean;
}

/**
 * A keyset-paginated window over a newest-first list. The observable holds
 * only the rows loaded so far (the first page, plus pages the user scrolled
 * to), never the table. Loading more reads the next page after the last row;
 * a commit re-reads the rows down to that same row, an indexed range scan, so
 * new rows appear at the top and scrolling never jumps.
 */
export function useKeysetWindow<T>(
  tables: readonly TableName[],
  query: KeysetQuery<T>,
  deps: readonly unknown[],
  pageSize = 50,
  label = "window",
) {
  const state$ = useObservable({
    rows: [],
    hasMore: false,
    loaded: false,
  }) as unknown as Observable<WindowState<unknown>>;
  const epoch = useSelector(dbEpoch$);
  const anchor = useRef<Keyset | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const loadingMore = useRef(false);

  useEffect(() => {
    anchor.current = null;
    state$.set({ rows: [], hasMore: false, loaded: !peekDb() });
    const handle = liveQuery(
      tables,
      async (orm) => {
        const q = queryRef.current;
        const from = anchor.current;
        const rows = from
          ? await q.through(orm, from)
          : await q.page(orm, null, pageSize);
        return { rows, first: !from, from };
      },
      ({ rows, first, from }) => {
        // "Load more" moved the anchor meanwhile: read again down to it.
        if (from !== anchor.current) {
          handle.refresh();
          return;
        }
        const last = rows[rows.length - 1];
        anchor.current = last ? queryRef.current.keyOf(last) : null;
        state$.set((s) => ({
          rows: rows as unknown[],
          hasMore: first ? rows.length === pageSize : s.hasMore,
          loaded: true,
        }));
      },
      label,
    );
    return handle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, pageSize, tables.join(","), ...deps]);

  const loadMore = useCallback(async () => {
    const db = peekDb();
    const { hasMore } = state$.peek();
    if (!db || !hasMore || loadingMore.current || !anchor.current) return;
    loadingMore.current = true;
    try {
      const more = await timed(`${label}.more`, () =>
        queryRef.current.page(db.orm, anchor.current, pageSize),
      );
      const last = more[more.length - 1];
      if (last) anchor.current = queryRef.current.keyOf(last);
      state$.set((s) => ({
        rows: [...s.rows, ...(more as unknown[])],
        hasMore: more.length === pageSize,
        loaded: true,
      }));
    } finally {
      loadingMore.current = false;
    }
  }, [state$, pageSize, label]);

  const state = useSelector(() => state$.get()) as WindowState<T>;
  return { ...state, loadMore };
}
