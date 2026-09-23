import type { GnssFix } from "@/types/Capture";
import {
  averageFixes,
  INITIAL_GATE_STATE,
  MAX_FIX_AGE_MS,
  meterFill,
  reduceGate,
  type GateState,
} from "../accuracyGate";

const NOW = 1_000_000;

const fix = (
  accuracy: number | null,
  over: Partial<GnssFix> = {},
): GnssFix => ({
  latitude: 0.3476,
  longitude: 32.5825,
  altitude: 1190,
  accuracy,
  altitudeAccuracy: null,
  timestamp: NOW,
  mocked: false,
  satellites: null,
  fixType: null,
  bands: null,
  ...over,
});

const feed = (...fixes: GnssFix[]): GateState =>
  fixes.reduce((state, f) => reduceGate(state, f, NOW), INITIAL_GATE_STATE);

describe("reduceGate", () => {
  it("starts acquiring and locked", () => {
    expect(INITIAL_GATE_STATE).toMatchObject({
      status: "acquiring",
      streak: 0,
    });
  });

  it("stays imprecise at 4.0 m because the gate is strictly under 4 m", () => {
    expect(feed(fix(4))).toMatchObject({ status: "imprecise", streak: 0 });
  });

  it("confirms, then locks on the third consecutive fix under 4 m", () => {
    expect(feed(fix(3.9))).toMatchObject({ status: "confirming", streak: 1 });
    expect(feed(fix(3.9), fix(3.5))).toMatchObject({
      status: "confirming",
      streak: 2,
    });
    expect(feed(fix(3.9), fix(3.5), fix(2.8))).toMatchObject({
      status: "ready",
      streak: 3,
    });
  });

  it("restarts the streak after an imprecise fix", () => {
    expect(feed(fix(3), fix(3), fix(6), fix(3))).toMatchObject({
      status: "confirming",
      streak: 1,
    });
  });

  it("drops the lock as soon as a fix is too imprecise", () => {
    expect(feed(fix(3), fix(3), fix(3), fix(5.2))).toMatchObject({
      status: "imprecise",
      streak: 0,
    });
  });

  it("rejects fixes older than 2 seconds", () => {
    const stale = fix(2, { timestamp: NOW - MAX_FIX_AGE_MS - 1 });
    expect(feed(fix(2), fix(2), stale)).toMatchObject({
      status: "imprecise",
      streak: 0,
    });
  });

  it("reports unknown when the platform gives no accuracy", () => {
    expect(feed(fix(null))).toMatchObject({ status: "unknown", streak: 0 });
  });

  it("keeps only the last five qualifying fixes for averaging", () => {
    const state = feed(...[1, 2, 3, 3.1, 3.2, 3.3, 3.4].map((a) => fix(a)));
    expect(state.window.map((f) => f.accuracy)).toEqual([
      3, 3.1, 3.2, 3.3, 3.4,
    ]);
  });
});

describe("averageFixes", () => {
  it("returns null with nothing to average", () => {
    expect(averageFixes([])).toBeNull();
  });

  it("averages position, altitude and accuracy and keeps the raw fixes", () => {
    const fixes = [
      fix(2, { latitude: 1, longitude: 10, altitude: 100 }),
      fix(4, { latitude: 3, longitude: 20, altitude: null }),
    ];
    expect(averageFixes(fixes)).toEqual({
      latitude: 2,
      longitude: 15,
      altitude: 100,
      accuracy: 3,
      fixes,
    });
  });
});

describe("meterFill", () => {
  it("maps 8 m → 0 and 0 m → 1, clamped", () => {
    expect(meterFill(8)).toBe(0);
    expect(meterFill(4)).toBe(0.5);
    expect(meterFill(0)).toBe(1);
    expect(meterFill(20)).toBe(0);
    expect(meterFill(null)).toBe(0);
  });
});
