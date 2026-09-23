import {
  averageFixes,
  INITIAL_GATE_STATE,
  reduceGate,
  type AveragedFix,
  type GateState,
  type GateStatus,
} from "@/helpers/accuracyGate";
import { getGnssSource } from "@/services/location/GnssSource";
import type { GnssFix } from "@/types/Capture";
import { useEffect, useMemo, useReducer, useState } from "react";

export type CaptureGateStatus = GateStatus | "denied" | "error";

export interface CaptureAccuracyGate {
  status: CaptureGateStatus;
  /** True once 3 consecutive fixes are under 4 m (design-doc §5.1). */
  isReady: boolean;
  /** Latest horizontal accuracy in metres; null before a fix or when unreported. */
  accuracy: number | null;
  /** Consecutive qualifying fixes, 0–3. */
  streak: number;
  latest: GnssFix | null;
  /** Mean of the last 5 qualifying fixes: the position stamped on a capture. */
  averaged: AveragedFix | null;
  /** Degrees from true north; null without a compass reading. */
  heading: number | null;
  /** Epoch ms when the gate started waiting; drives the "save as draft" offer. */
  startedAt: number;
  error: string | null;
}

type Action = { type: "fix"; fix: GnssFix } | { type: "reset" };

function reducer(state: GateState, action: Action): GateState {
  return action.type === "fix"
    ? reduceGate(state, action.fix)
    : INITIAL_GATE_STATE;
}

/**
 * Streams GNSS fixes from the current source (expo-location, or the dev
 * simulator under `start:mock`) and gates capture on horizontal accuracy under
 * 4.0 m for 3 fixes in a row. Accuracy is a 68% radius, not a guarantee; a
 * platform that reports none keeps capture locked ("unknown").
 */
export function useCaptureAccuracyGate(enabled = true): CaptureAccuracyGate {
  const [gate, dispatch] = useReducer(reducer, INITIAL_GATE_STATE);
  const [heading, setHeading] = useState<number | null>(null);
  const [failure, setFailure] = useState<{
    kind: "denied" | "error";
    message: string | null;
  } | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    dispatch({ type: "reset" });
    setFailure(null);
    setStartedAt(Date.now());

    getGnssSource()
      .start({
        onFix: (fix) => {
          if (!cancelled) dispatch({ type: "fix", fix });
        },
        onHeading: (degrees) => {
          if (!cancelled) setHeading(degrees);
        },
        onError: (kind, message) => {
          if (!cancelled) setFailure({ kind, message: message ?? null });
        },
      })
      .then((stopSource) => {
        // Unmounted while the source was starting.
        if (cancelled) stopSource();
        else stop = stopSource;
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setFailure({
            kind: "error",
            message: e instanceof Error ? e.message : null,
          });
        }
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);

  const averaged = useMemo(() => averageFixes(gate.window), [gate.window]);
  const status: CaptureGateStatus = failure?.kind ?? gate.status;

  return {
    status,
    isReady: status === "ready",
    accuracy: gate.latest?.accuracy ?? null,
    streak: gate.streak,
    latest: gate.latest,
    averaged,
    heading,
    startedAt,
    error: failure?.message ?? null,
  };
}
