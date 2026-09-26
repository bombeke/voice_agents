import { observations, outbox } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import { saveObservations } from "@/services/storage/repos/ObservationRepo";
import {
  enqueue,
  inFlightOutboxId,
  setInFlightOutboxId,
  type OutboxRow,
} from "../Outbox";
import {
  classifyError,
  drainOutbox,
  MAX_SERVER_ERROR_ATTEMPTS,
  retryFailed,
  type OutboxHandlers,
} from "../OutboxWorker";

const NOW = 1_790_000_000_000;
const httpError = (status?: number) =>
  Object.assign(
    new Error(`HTTP ${status ?? "offline"}`),
    status ? { response: { status } } : {},
  );

const getDb = setupTestDatabase();

function handlers(send: jest.Mock) {
  const onDelivered = jest.fn(async () => undefined);
  const onRefused = jest.fn(async () => undefined);
  const h: OutboxHandlers = {
    observation: { send, onDelivered, onRefused },
    review_decision: { send, onDelivered, onRefused },
  };
  return { h, onDelivered, onRefused };
}

const save = (pid: string, over: Record<string, unknown> = {}, now = NOW) =>
  getDb().write((tx) =>
    saveObservations(tx, [{ pid, latitude: 1, longitude: 2, ...over }], {
      deviceId: "dev",
      now,
    }),
  );

const rows = () => getDb().orm.select().from(outbox);

describe("enqueue (write path)", () => {
  it("writes the record and its outbox row in one transaction, or neither", async () => {
    await expect(
      getDb().write(async (tx) => {
        await saveObservations(tx, [{ pid: "p1", latitude: 1, longitude: 2 }], {
          deviceId: "dev",
          now: NOW,
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await getDb().orm.select().from(observations)).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("keeps one waiting row per record; an unsent insert stays an insert", async () => {
    await save("p1");
    await save("p1", { comment: "second" }, NOW + 1);
    const [row] = await rows();
    expect(await rows()).toHaveLength(1);
    expect(row).toMatchObject({
      op: "insert",
      payload: expect.objectContaining({ comment: "second" }),
    });
  });

  it("drops an insert the server never saw when the record is deleted", async () => {
    await save("p1");
    await getDb().write((tx) =>
      enqueue(
        tx,
        {
          entity: "observation",
          entityId: "p1",
          op: "delete",
          payload: {},
          idempotencyKey: "k-del",
        },
        NOW,
      ),
    );
    expect(await rows()).toEqual([]);
  });

  it("never replaces the row in flight: a newer change queues behind it", async () => {
    await save("p1");
    const [sending] = await rows();
    setInFlightOutboxId(sending.id);
    try {
      await save("p1", { comment: "during upload" }, NOW + 1);
    } finally {
      setInFlightOutboxId(null);
    }
    const all = await rows();
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.id !== sending.id)?.op).toBe("update");
    expect(inFlightOutboxId()).toBeNull();
  });
});

describe("drainOutbox", () => {
  it("sends oldest first with each row's idempotency key, and removes delivered rows", async () => {
    await save("p1", {}, NOW);
    await save("p2", {}, NOW + 1);
    const send = jest.fn(async (_row: OutboxRow) => undefined);
    const { h, onDelivered } = handlers(send);

    const result = await drainOutbox(getDb(), h, { now: () => NOW + 10 });

    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      deferred: false,
      nextDueAt: null,
    });
    expect(
      send.mock.calls.map(([r]) => [r.entityId, r.idempotencyKey]),
    ).toEqual([
      ["p1", "pole-p1-dev-1"],
      ["p2", "pole-p2-dev-1"],
    ]);
    expect(onDelivered).toHaveBeenCalledTimes(2);
    expect(await rows()).toEqual([]);
  });

  it("backs off on a retryable failure, persisting when to try next, and stops the run", async () => {
    await save("p1", {}, NOW);
    await save("p2", {}, NOW + 1);
    const send = jest.fn(async () => {
      throw httpError(); // offline
    });
    const result = await drainOutbox(getDb(), handlers(send).h, {
      now: () => NOW + 10,
      random: () => 0,
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [p1] = (await rows()).filter((r) => r.entityId === "p1");
    expect(p1).toMatchObject({
      attemptCount: 1,
      nextAttemptAt: NOW + 10 + 2_500,
      state: "pending",
    });
    expect(result).toMatchObject({ deferred: true, nextDueAt: NOW + 1 });
  });

  it("skips rows that aren't due yet", async () => {
    await save("p1");
    await getDb().write((tx) =>
      tx.update(outbox).set({ nextAttemptAt: NOW + 60_000 }),
    );
    const send = jest.fn();
    const result = await drainOutbox(getDb(), handlers(send).h, {
      now: () => NOW,
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.nextDueAt).toBe(NOW + 60_000);
  });

  it("parks a refused row as failed (never silently dropped) and carries on", async () => {
    await save("p1", {}, NOW);
    await save("p2", {}, NOW + 1);
    const send = jest.fn(async (row) => {
      if (row.entityId === "p1")
        throw Object.assign(httpError(422), {
          response: { status: 422, data: { detail: "bad" } },
        });
    });
    const { h, onRefused } = handlers(send);
    const result = await drainOutbox(getDb(), h, { now: () => NOW + 10 });

    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(await rows()).toEqual([
      expect.objectContaining({
        entityId: "p1",
        state: "failed",
        lastStatus: 422,
        lastError: "bad",
      }),
    ]);

    await retryFailed(getDb(), NOW + 20);
    expect(await rows()).toEqual([
      expect.objectContaining({ state: "pending", attemptCount: 0 }),
    ]);
  });

  it("survives a restart: state lives in the table, not in memory", async () => {
    await save("p1");
    await getDb().write((tx) =>
      tx.update(outbox).set({ attemptCount: 3, nextAttemptAt: NOW - 1 }),
    );
    const send = jest.fn(async () => undefined);
    // A fresh worker (e.g. after a cold start) finds the row due and sends it.
    expect(
      (await drainOutbox(getDb(), handlers(send).h, { now: () => NOW })).sent,
    ).toBe(1);
  });
});

describe("classifyError", () => {
  const row = { op: "update", attemptCount: 0 } as never;
  it.each([
    [undefined, "retry"],
    [401, "retry"],
    [429, "retry"],
    [500, "retry"],
    [409, "done"],
    [400, "fail"],
    [422, "fail"],
  ])("HTTP %s → %s", (status, outcome) => {
    expect(classifyError(httpError(status), row)).toBe(outcome);
  });

  it("treats a missing record as deleted for a delete, and gives up on 5xx eventually", () => {
    expect(
      classifyError(httpError(404), { op: "delete", attemptCount: 0 } as never),
    ).toBe("done");
    expect(
      classifyError(httpError(503), {
        op: "update",
        attemptCount: MAX_SERVER_ERROR_ATTEMPTS - 1,
      } as never),
    ).toBe("fail");
  });
});
