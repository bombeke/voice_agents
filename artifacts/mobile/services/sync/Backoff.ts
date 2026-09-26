/**
 * Retry schedule for the outbox and attachment workers. The result is stored
 * in the row's `next_attempt_at`, so the schedule survives restarts.
 *
 * Exponential with "equal jitter": attempt n waits a random time between half
 * and all of min(base · 2^(n-1), max), so devices that went offline together
 * don't retry in lockstep, and none retries sooner than half the step.
 */

export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 5_000,
  maxMs: 30 * 60_000,
};

/** The un-jittered ceiling for failure number `attempt` (1 = first failure). */
export function backoffCeiling(
  attempt: number,
  { baseMs, maxMs }: BackoffOptions = DEFAULT_BACKOFF,
): number {
  const n = Math.max(1, Math.floor(attempt));
  // 2^(n-1) overflows to Infinity for large n; min() still caps it.
  return Math.min(baseMs * 2 ** (n - 1), maxMs);
}

/** A delay in [ceiling / 2, ceiling]. `random` is injectable for tests. */
export function backoffDelay(
  attempt: number,
  random: () => number = Math.random,
  options: BackoffOptions = DEFAULT_BACKOFF,
): number {
  const ceiling = backoffCeiling(attempt, options);
  const r = Math.min(Math.max(random(), 0), 1);
  return Math.round(ceiling / 2 + r * (ceiling / 2));
}

/** Epoch ms of the next try after failure number `attempt`. */
export function nextAttemptAt(
  attempt: number,
  now: number,
  random: () => number = Math.random,
  options: BackoffOptions = DEFAULT_BACKOFF,
): number {
  return now + backoffDelay(attempt, random, options);
}
