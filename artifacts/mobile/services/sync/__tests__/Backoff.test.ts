import {
  backoffCeiling,
  backoffDelay,
  DEFAULT_BACKOFF,
  nextAttemptAt,
} from "../Backoff";

describe("backoff schedule", () => {
  it("doubles from the base on each failure", () => {
    expect([1, 2, 3, 4, 5].map((n) => backoffCeiling(n))).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000,
    ]);
  });

  it("is capped at the maximum, however many failures", () => {
    expect(backoffCeiling(9)).toBe(1_280_000);
    expect(backoffCeiling(10)).toBe(DEFAULT_BACKOFF.maxMs);
    expect(backoffCeiling(50)).toBe(DEFAULT_BACKOFF.maxMs);
    // 2^2000 is Infinity; still capped, never NaN.
    expect(backoffCeiling(2000)).toBe(DEFAULT_BACKOFF.maxMs);
  });

  it("treats attempt 0 or less like the first failure", () => {
    expect(backoffCeiling(0)).toBe(5_000);
    expect(backoffCeiling(-3)).toBe(5_000);
  });

  it("jitters between half and all of the ceiling", () => {
    expect(backoffDelay(3, () => 0)).toBe(10_000);
    expect(backoffDelay(3, () => 1)).toBe(20_000);
    expect(backoffDelay(3, () => 0.5)).toBe(15_000);
    for (let i = 0; i < 200; i++) {
      const d = backoffDelay(4);
      expect(d).toBeGreaterThanOrEqual(20_000);
      expect(d).toBeLessThanOrEqual(40_000);
    }
  });

  it("clamps a random source that strays outside [0, 1]", () => {
    expect(backoffDelay(1, () => -1)).toBe(2_500);
    expect(backoffDelay(1, () => 7)).toBe(5_000);
  });

  it("gives the absolute time of the next try", () => {
    expect(nextAttemptAt(2, 1_000_000, () => 0)).toBe(1_005_000);
  });

  it("takes other bases and caps", () => {
    const opts = { baseMs: 100, maxMs: 1000 };
    expect([1, 2, 3, 4, 5].map((n) => backoffCeiling(n, opts))).toEqual([
      100, 200, 400, 800, 1000,
    ]);
  });
});
