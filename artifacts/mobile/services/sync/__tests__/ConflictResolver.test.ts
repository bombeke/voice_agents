import {
  bumpVC,
  compareVC,
  compareVersions,
  mergeFields,
  mergeVC,
  resolveConflict,
  stampLocalEdit,
  type Versioned,
} from "../ConflictResolver";

const NOW = Date.parse("2026-09-25T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const opts = (
  over: Partial<{ deviceId: string; now: number; hasQueued: boolean }> = {},
) => ({
  deviceId: "dev-a",
  now: NOW,
  hasQueued: false,
  ...over,
});

const pole = (over: Partial<Versioned> = {}): Versioned => ({
  pid: "p1",
  comment: "",
  statuses: ["good"],
  updatedAt: iso(NOW - 60_000),
  deviceId: "dev-a",
  vc: { "dev-a": 1 },
  ...over,
});

describe("vector clocks", () => {
  it.each([
    [{ a: 1 }, { a: 1 }, "EQUAL"],
    [{ a: 2 }, { a: 1 }, "AFTER"],
    [{ a: 1 }, { a: 1, b: 1 }, "BEFORE"],
    [{ a: 2, b: 1 }, { a: 1, b: 2 }, "CONCURRENT"],
    [{}, {}, "EQUAL"],
  ] as const)("%j vs %j is %s", (a, b, rel) => {
    expect(compareVC(a, b)).toBe(rel);
  });

  it("merges by taking each device's highest counter, and bumps one slot", () => {
    expect(mergeVC({ a: 3, b: 1 }, { b: 4, c: 2 })).toEqual({
      a: 3,
      b: 4,
      c: 2,
    });
    expect(bumpVC({ a: 3 }, "b")).toEqual({ a: 3, b: 1 });
  });

  it("falls back to updatedAt when either side has no clock", () => {
    expect(
      compareVersions(
        { updatedAt: iso(2) },
        { vc: { a: 9 }, updatedAt: iso(1) },
      ),
    ).toBe("AFTER");
    expect(compareVersions({}, { updatedAt: iso(1) })).toBe("BEFORE");
  });
});

describe("stampLocalEdit", () => {
  it("advances this device's clock and stamps only the fields that changed", () => {
    const prev = pole({ fieldUpdatedAt: { statuses: 5 } });
    const next = stampLocalEdit(
      prev,
      { pid: "p1", comment: "leaning", statuses: ["good"] },
      "dev-a",
      NOW,
    );
    expect(next.vc).toEqual({ "dev-a": 2 });
    expect(next.fieldUpdatedAt).toEqual({ statuses: 5, comment: NOW });
    expect(next).toMatchObject({
      synced: false,
      deleted: false,
      deviceId: "dev-a",
      updatedAt: iso(NOW),
    });
  });
});

describe("resolveConflict", () => {
  it("stores a record it has never seen as synced", () => {
    const remote = pole({ deviceId: "dev-b", vc: { "dev-b": 1 } });
    expect(resolveConflict(undefined, remote, opts())).toMatchObject({
      record: { ...remote, synced: true },
      push: false,
      dropQueued: false,
    });
  });

  it("takes a strictly newer server version whole and drops the stale upload", () => {
    const local = pole({ comment: "mine", imageUri: "file:///captures/1.jpg" });
    const remote = pole({
      comment: "theirs",
      vc: { "dev-a": 1, "dev-b": 1 },
      imageUri: "https://x/1.jpg",
    });
    const res = resolveConflict(local, remote, opts({ hasQueued: true }));
    expect(res.relation).toBe("BEFORE");
    expect(res.record).toMatchObject({ comment: "theirs", synced: true });
    // The photo on this device survives: the server's path is not ours.
    expect(res.record.imageUri).toBe("file:///captures/1.jpg");
    expect(res.dropQueued).toBe(true);
    expect(res.push).toBe(false);
  });

  it("keeps a newer local version and asks for a push only if none is queued", () => {
    const local = pole({ comment: "mine", vc: { "dev-a": 2 } });
    const remote = pole({ comment: "old" });
    expect(
      resolveConflict(local, remote, opts({ hasQueued: true })),
    ).toMatchObject({
      record: { comment: "mine", synced: false },
      push: false,
    });
    expect(
      resolveConflict(local, remote, opts({ hasQueued: false })).push,
    ).toBe(true);
  });

  it("on an equal version keeps local values and picks up server-only fields", () => {
    const local = pole({ comment: "same" });
    const remote = pole({ comment: "same", dhis2Id: "EP-1" });
    expect(resolveConflict(local, remote, opts()).record).toMatchObject({
      comment: "same",
      dhis2Id: "EP-1",
      synced: true,
    });
  });

  describe("concurrent edits: field-level merge", () => {
    const base = { "dev-a": 1, "dev-b": 1 };
    const local = pole({
      vc: { ...base, "dev-a": 2 },
      comment: "rust at base",
      statuses: ["rust"],
      fieldUpdatedAt: { comment: NOW - 10_000, statuses: NOW - 30_000 },
    });
    const remote = pole({
      deviceId: "dev-b",
      vc: { ...base, "dev-b": 2 },
      comment: "leaning",
      statuses: ["inclined"],
      functional: "no",
      fieldUpdatedAt: {
        comment: NOW - 20_000,
        statuses: NOW - 5_000,
        functional: NOW - 5_000,
      },
    });

    it("gives each field to the side that changed it last", () => {
      const res = resolveConflict(local, remote, opts());
      expect(res.relation).toBe("CONCURRENT");
      expect(res.record).toMatchObject({
        comment: "rust at base", // local changed it later
        statuses: ["inclined"], // remote changed it later
        functional: "no", // only remote has it
      });
    });

    it("gets a clock that dominates both sides, and is pushed", () => {
      const res = resolveConflict(local, remote, opts());
      expect(compareVC(res.record.vc, local.vc)).toBe("AFTER");
      expect(compareVC(res.record.vc, remote.vc)).toBe("AFTER");
      expect(res).toMatchObject({ push: true, dropQueued: true });
      expect(res.record).toMatchObject({
        synced: false,
        deviceId: "dev-a",
        updatedAt: iso(NOW),
      });
    });

    it("merges to the same values on both devices", () => {
      const onA = mergeFields(local, remote);
      const onB = mergeFields(remote, local);
      for (const k of ["comment", "statuses", "functional"])
        expect(onA[k]).toEqual(onB[k]);
    });

    it("breaks an exact tie by the higher device id, on either device", () => {
      const t = NOW - 1000;
      const a = pole({
        vc: { "dev-a": 2, "dev-b": 1 },
        comment: "A",
        fieldUpdatedAt: { comment: t },
      });
      const b = pole({
        deviceId: "dev-b",
        vc: { "dev-a": 1, "dev-b": 2 },
        comment: "B",
        fieldUpdatedAt: { comment: t },
      });
      expect(mergeFields(a, b).comment).toBe("B");
      expect(mergeFields(b, a).comment).toBe("B");
    });

    it("uses the record's updatedAt for fields without their own stamp (last write wins)", () => {
      const a = pole({
        vc: { "dev-a": 2, "dev-b": 1 },
        comment: "older",
        updatedAt: iso(NOW - 9000),
        fieldUpdatedAt: undefined,
      });
      const b = pole({
        deviceId: "dev-b",
        vc: { "dev-a": 1, "dev-b": 2 },
        comment: "newer",
        updatedAt: iso(NOW - 1000),
        fieldUpdatedAt: undefined,
      });
      expect(resolveConflict(a, b, opts()).record.comment).toBe("newer");
    });

    it("lets a delete beat a concurrent edit", () => {
      const deleted = { ...remote, deleted: true };
      expect(resolveConflict(local, deleted, opts()).record.deleted).toBe(true);
    });
  });

  describe("local deletes (tombstones)", () => {
    const tomb = pole({ deleted: true, vc: { "dev-a": 2 } });

    it("survive an older or concurrent server version", () => {
      expect(
        resolveConflict(tomb, pole(), opts({ hasQueued: true })).record.deleted,
      ).toBe(true);
      const concurrent = pole({
        deviceId: "dev-b",
        vc: { "dev-a": 1, "dev-b": 1 },
      });
      expect(resolveConflict(tomb, concurrent, opts()).record.deleted).toBe(
        true,
      );
    });

    it("give way to an edit made after seeing the delete", () => {
      const revived = pole({
        deviceId: "dev-b",
        vc: { "dev-a": 2, "dev-b": 1 },
        comment: "rebuilt",
      });
      const res = resolveConflict(tomb, revived, opts({ hasQueued: true }));
      expect(res.record).toMatchObject({
        deleted: false,
        comment: "rebuilt",
        synced: true,
      });
      expect(res.dropQueued).toBe(true);
    });
  });

  it("without clocks, the later updatedAt wins whole", () => {
    const local = pole({
      vc: {},
      comment: "local",
      updatedAt: iso(NOW - 5000),
    });
    const remote = pole({
      vc: {},
      comment: "remote",
      updatedAt: iso(NOW - 1000),
    });
    expect(resolveConflict(local, remote, opts()).record.comment).toBe(
      "remote",
    );
    expect(resolveConflict(remote, local, opts()).record.comment).toBe(
      "remote",
    );
  });
});
