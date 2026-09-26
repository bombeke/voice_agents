/**
 * Query and transaction timings, collected only while the debug flag is on
 * (`EXPO_PUBLIC_DB_TIMING=1`, or `setDbTiming(true)` at runtime). Durations
 * are wall-clock on the JS thread, from the call to the resolved result.
 */

const MAX_SAMPLES = 500;

let enabled = process.env.EXPO_PUBLIC_DB_TIMING === "1";
const samples = new Map<string, number[]>();
const marks = new Map<string, number>();

export const isDbTimingEnabled = () => enabled;

export function setDbTiming(on: boolean) {
  enabled = on;
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function recordTiming(label: string, ms: number) {
  if (!enabled) return;
  const list = samples.get(label) ?? [];
  list.push(ms);
  if (list.length > MAX_SAMPLES) list.shift();
  samples.set(label, list);
  console.log(`[db] ${label} ${ms.toFixed(1)} ms`);
}

/** Times `fn` under `label` when timing is on; otherwise just runs it. */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) return fn();
  const start = now();
  try {
    return await fn();
  } finally {
    recordTiming(label, now() - start);
  }
}

/** Starts a span that `endMark` closes, e.g. cold start to first list paint. */
export function mark(label: string) {
  if (enabled && !marks.has(label)) marks.set(label, now());
}

export function endMark(label: string) {
  const start = marks.get(label);
  if (start === undefined) return;
  marks.delete(label);
  recordTiming(label, now() - start);
}

export interface TimingStats {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

/** Per label: count, p50, p95 and max, in ms. */
export function timingReport(): Record<string, TimingStats> {
  const out: Record<string, TimingStats> = {};
  for (const [label, list] of samples) {
    const sorted = [...list].sort((a, b) => a - b);
    out[label] = {
      count: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted[sorted.length - 1],
    };
  }
  return out;
}

export function resetTimings() {
  samples.clear();
  marks.clear();
}
