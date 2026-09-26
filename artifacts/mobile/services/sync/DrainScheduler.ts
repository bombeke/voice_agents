export interface DrainScheduler {
  /** Asks for a run after `delayMs` (default: the debounce); an earlier request wins. */
  signal(delayMs?: number): void;
  /** Runs now, or joins the run in progress (then runs once more). */
  runNow(): Promise<void>;
  /** Resolves when no run is in progress. */
  settle(): Promise<void>;
  stop(): void;
}

interface Options {
  /** Coalesces bursts of signals (e.g. a capture with several detections). */
  debounceMs?: number;
  /** No run starts while this is false; `signal` again when it turns true. */
  canRun?: () => boolean;
  now?: () => number;
  label?: string;
}

/**
 * Single-flight runner for a drain worker. At most one run at a time; a
 * signal during a run triggers exactly one more. After a run it sleeps until
 * the next due row (`nextDueAt`, read from the database), so the schedule
 * lives in SQLite and survives restarts: on cold start, `signal(0)` picks it
 * up again.
 */
export function createDrainScheduler(
  run: () => Promise<{ nextDueAt: number | null }>,
  {
    debounceMs = 750,
    canRun = () => true,
    now = Date.now,
    label = "drain",
  }: Options = {},
): DrainScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timerAt = Infinity;
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    timerAt = Infinity;
  };

  const schedule = (delayMs: number) => {
    if (stopped) return;
    const at = now() + Math.max(0, delayMs);
    if (timer && timerAt <= at) return;
    clear();
    timerAt = at;
    timer = setTimeout(
      () => {
        timer = undefined;
        timerAt = Infinity;
        void runNow();
      },
      Math.max(0, delayMs),
    );
  };

  const loop = async () => {
    do {
      again = false;
      if (!canRun()) return;
      try {
        const { nextDueAt } = await run();
        if (nextDueAt !== null && !again) schedule(nextDueAt - now());
      } catch (err) {
        console.warn(`[${label}] run failed`, err);
      }
    } while (again && !stopped);
  };

  function runNow(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    clear();
    running = loop().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    signal: (delayMs = debounceMs) => schedule(delayMs),
    runNow,
    settle: async () => {
      await running;
    },
    stop: () => {
      stopped = true;
      clear();
    },
  };
}
