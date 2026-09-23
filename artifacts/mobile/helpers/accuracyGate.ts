import type { GnssFix } from "@/types/Capture";

/** A fix must be strictly better than this (metres) to count (design-doc §5.1). */
export const MAX_CAPTURE_ACCURACY_M = 4;
/** Consecutive qualifying fixes needed before capture unlocks. */
export const REQUIRED_GOOD_FIXES = 3;
/** Fixes older than this when they arrive are rejected. */
export const MAX_FIX_AGE_MS = 2000;
/** How many qualifying fixes are averaged into the stamped position. */
export const AVERAGE_WINDOW = 5;
/** The accuracy meter's left end, in metres. */
export const METER_RANGE_M = 8;

export type GateStatus =
  | "acquiring" // no fix yet
  | "unknown" // the platform reports no accuracy value
  | "imprecise" // latest fix is 4 m or worse
  | "confirming" // under 4 m, waiting for 3 in a row
  | "ready";

export interface GateState {
  status: GateStatus;
  latest: GnssFix | null;
  /** Consecutive qualifying fixes, capped at REQUIRED_GOOD_FIXES. */
  streak: number;
  /** The last AVERAGE_WINDOW qualifying fixes, oldest first. */
  window: GnssFix[];
}

export const INITIAL_GATE_STATE: GateState = {
  status: "acquiring",
  latest: null,
  streak: 0,
  window: [],
};

export function isQualifying(fix: GnssFix, now: number): boolean {
  return (
    fix.accuracy !== null &&
    fix.accuracy < MAX_CAPTURE_ACCURACY_M &&
    now - fix.timestamp <= MAX_FIX_AGE_MS
  );
}

/**
 * Folds one fix into the gate. A stale or imprecise fix breaks the streak but
 * keeps the averaging window, so a single bad reading doesn't throw away the
 * good ones already collected.
 */
export function reduceGate(
  state: GateState,
  fix: GnssFix,
  now: number = Date.now(),
): GateState {
  if (!isQualifying(fix, now)) {
    return {
      ...state,
      latest: fix,
      streak: 0,
      status: fix.accuracy === null ? "unknown" : "imprecise",
    };
  }
  const streak = Math.min(REQUIRED_GOOD_FIXES, state.streak + 1);
  return {
    latest: fix,
    streak,
    window: [...state.window, fix].slice(-AVERAGE_WINDOW),
    status: streak >= REQUIRED_GOOD_FIXES ? "ready" : "confirming",
  };
}

export interface AveragedFix {
  latitude: number;
  longitude: number;
  altitude: number | null;
  /** Mean horizontal accuracy of the averaged fixes. */
  accuracy: number;
  /** The raw fixes behind the average, kept for the record (§5.1). */
  fixes: GnssFix[];
}

/** Mean of the window; null when there is nothing to average. */
export function averageFixes(window: GnssFix[]): AveragedFix | null {
  if (window.length === 0) return null;
  const mean = (pick: (f: GnssFix) => number) =>
    window.reduce((sum, f) => sum + pick(f), 0) / window.length;
  const altitudes = window.filter((f) => f.altitude !== null);
  return {
    latitude: mean((f) => f.latitude),
    longitude: mean((f) => f.longitude),
    altitude: altitudes.length
      ? altitudes.reduce((sum, f) => sum + (f.altitude as number), 0) /
        altitudes.length
      : null,
    accuracy: mean((f) => f.accuracy as number),
    fixes: window,
  };
}

/** Fill of the 8 m → 0 m meter, 0–1. */
export function meterFill(accuracy: number | null): number {
  if (accuracy === null) return 0;
  return Math.max(0, Math.min(1, (METER_RANGE_M - accuracy) / METER_RANGE_M));
}
