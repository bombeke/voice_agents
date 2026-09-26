import { createDrainScheduler } from "../DrainScheduler";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

it("never runs two drains at once; a signal during a run causes exactly one more", async () => {
  let active = 0;
  let maxActive = 0;
  const gates = [deferred(), deferred()];
  let call = 0;
  const run = jest.fn(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await gates[call++]?.promise;
    active--;
    return { nextDueAt: null };
  });
  const s = createDrainScheduler(run);

  const first = s.runNow();
  s.runNow();
  s.runNow();
  gates[0].resolve();
  gates[1].resolve();
  await first;
  await s.settle();

  expect(run).toHaveBeenCalledTimes(2);
  expect(maxActive).toBe(1);
});

it("debounces signals and sleeps until the next due row", async () => {
  const now = { t: 0 };
  let calls = 0;
  const run = jest.fn(async (): Promise<{ nextDueAt: number | null }> => ({
    nextDueAt: ++calls === 1 ? now.t + 10_000 : null,
  }));
  const s = createDrainScheduler(run, { debounceMs: 750, now: () => now.t });

  s.signal();
  s.signal();
  await jest.advanceTimersByTimeAsync(749);
  expect(run).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(9_999);
  expect(run).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  s.stop();
});

it("doesn't run while it can't (offline), and stops for good", async () => {
  let online = false;
  const run = jest.fn(async () => ({ nextDueAt: null }));
  const s = createDrainScheduler(run, { canRun: () => online });
  await s.runNow();
  expect(run).not.toHaveBeenCalled();
  online = true;
  await s.runNow();
  expect(run).toHaveBeenCalledTimes(1);
  s.stop();
  await s.runNow();
  expect(run).toHaveBeenCalledTimes(1);
});
