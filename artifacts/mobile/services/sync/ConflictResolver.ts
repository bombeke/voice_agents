/**
 * The one place that decides what happens when this device's version of a
 * record meets the server's. Policy: field-level merge ordered by vector
 * clock, falling back to last-write-wins.
 *
 * 1. Both versions carry vector clocks: the clock says which one is newer.
 *    A strictly newer version wins whole.
 * 2. The clocks are concurrent (both sides changed it without seeing the
 *    other): merge field by field. Each field takes the side that changed it
 *    last (`fieldUpdatedAt`, else the record's `updatedAt`); a tie goes to the
 *    higher device id, so every device picks the same value. A delete beats
 *    an edit. The merge gets a new clock that dominates both and is pushed.
 * 3. A version without a clock (older builds, server-made records): the later
 *    `updatedAt` wins whole.
 *
 * A local delete (tombstone) survives until an edit made after seeing it
 * arrives. The local photo path always survives: the server's is another
 * device's file.
 */

export type VectorClock = Record<string, number>;

export type Relation = "BEFORE" | "AFTER" | "CONCURRENT" | "EQUAL";

/** A record as sync sees it: the pole payload plus its version stamps. */
export interface Versioned {
  pid: string;
  vc?: VectorClock;
  /** ISO 8601. */
  updatedAt?: string;
  deviceId?: string;
  deleted?: boolean;
  synced?: boolean;
  /** Epoch ms each field last changed, for the field-level merge. */
  fieldUpdatedAt?: Record<string, number>;
  imageUri?: string;
  [field: string]: unknown;
}

export interface Resolution {
  /** What the device should store now. */
  record: Versioned;
  /** How the local version relates to the remote one (BEFORE: remote is newer). */
  relation: Relation;
  /** A local change is still unknown to the server and must be sent. */
  push: boolean;
  /** A queued upload is obsolete (the server is newer, or it gets replaced). */
  dropQueued: boolean;
}

/** Fields that describe the version, not the record. */
const META_FIELDS = new Set([
  "pid",
  "vc",
  "updatedAt",
  "deviceId",
  "deleted",
  "synced",
  "syncedAt",
  "fieldUpdatedAt",
  "imageUri",
]);

export const hasClock = (vc?: VectorClock | null): vc is VectorClock =>
  !!vc && Object.keys(vc).length > 0;

export function compareVC(a: VectorClock = {}, b: VectorClock = {}): Relation {
  let gt = false;
  let lt = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    if (av > bv) gt = true;
    if (av < bv) lt = true;
  }
  if (gt && lt) return "CONCURRENT";
  if (gt) return "AFTER";
  if (lt) return "BEFORE";
  return "EQUAL";
}

export function mergeVC(a: VectorClock = {}, b: VectorClock = {}): VectorClock {
  const merged: VectorClock = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    merged[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return merged;
}

export const bumpVC = (vc: VectorClock | undefined, deviceId: string) => ({
  ...vc,
  [deviceId]: (vc?.[deviceId] ?? 0) + 1,
});

export const updatedAtMs = (p?: { updatedAt?: unknown }) => {
  const t = typeof p?.updatedAt === "string" ? Date.parse(p.updatedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** Vector clocks when both have one, else `updatedAt`. */
export function compareVersions(
  a: { vc?: VectorClock; updatedAt?: unknown },
  b: { vc?: VectorClock; updatedAt?: unknown },
): Relation {
  if (hasClock(a.vc) && hasClock(b.vc)) return compareVC(a.vc, b.vc);
  const at = updatedAtMs(a);
  const bt = updatedAtMs(b);
  if (at > bt) return "AFTER";
  if (at < bt) return "BEFORE";
  return "EQUAL";
}

const same = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * A local edit: applies `patch` over `prev`, stamps each changed field and
 * advances this device's clock.
 */
export function stampLocalEdit(
  prev: Versioned | undefined,
  patch: Partial<Versioned> & { pid: string },
  deviceId: string,
  now: number,
): Versioned {
  const fieldUpdatedAt = { ...prev?.fieldUpdatedAt };
  for (const [k, v] of Object.entries(patch)) {
    if (!META_FIELDS.has(k) && !same(prev?.[k], v)) fieldUpdatedAt[k] = now;
  }
  return {
    ...prev,
    ...patch,
    deleted: patch.deleted ?? false,
    synced: false,
    updatedAt: new Date(now).toISOString(),
    deviceId,
    fieldUpdatedAt,
    vc: bumpVC(mergeVC(prev?.vc, patch.vc), deviceId),
  };
}

/** Field by field: the side that changed it last; ties to the higher device id. */
export function mergeFields(local: Versioned, remote: Versioned): Versioned {
  const lBase = updatedAtMs(local);
  const rBase = updatedAtMs(remote);
  const lWinsTie = (local.deviceId ?? "") > (remote.deviceId ?? "");
  const merged: Versioned = { ...remote, ...local };
  const fieldUpdatedAt: Record<string, number> = {};

  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (META_FIELDS.has(k)) continue;
    const lt = local.fieldUpdatedAt?.[k] ?? lBase;
    const rt = remote.fieldUpdatedAt?.[k] ?? rBase;
    fieldUpdatedAt[k] = Math.max(lt, rt);
    if (!(k in remote)) continue;
    if (!(k in local) || rt > lt || (rt === lt && !lWinsTie)) {
      merged[k] = remote[k];
    }
  }
  return {
    ...merged,
    fieldUpdatedAt,
    vc: mergeVC(local.vc, remote.vc),
    deleted: !!(local.deleted || remote.deleted),
  };
}

/**
 * Resolves the server's version of a record against this device's.
 * `hasQueued`: an upload of the local version is waiting in the outbox.
 */
export function resolveConflict(
  local: Versioned | undefined,
  remote: Versioned,
  {
    deviceId,
    now,
    hasQueued,
  }: { deviceId: string; now: number; hasQueued: boolean },
): Resolution {
  if (!local) {
    return {
      record: { ...remote, deleted: !!remote.deleted, synced: true },
      relation: "BEFORE",
      push: false,
      dropQueued: false,
    };
  }

  const relation = compareVersions(local, remote);
  // Always an explicit flag: the stored row and the UI read it as a boolean.
  const keepImage = (r: Versioned): Versioned => ({
    ...r,
    deleted: !!r.deleted,
    ...(local.imageUri ? { imageUri: local.imageUri } : {}),
  });

  // Deleted here: only an edit made after seeing our delete brings it back.
  if (local.deleted && !(relation === "BEFORE" && !remote.deleted)) {
    return {
      record: { ...local, synced: !hasQueued },
      relation,
      push: false,
      dropQueued: false,
    };
  }

  switch (relation) {
    case "BEFORE":
      // The server is newer: take it; a queued older upload must not overwrite it.
      return {
        record: keepImage({ ...remote, synced: true }),
        relation,
        push: false,
        dropQueued: true,
      };
    case "AFTER":
      return {
        record: { ...local, synced: false },
        relation,
        push: !hasQueued,
        dropQueued: false,
      };
    case "EQUAL":
      // Same version: keep local values, pick up what only the server has (ids, URLs).
      return {
        record: keepImage({ ...remote, ...local, synced: !hasQueued }),
        relation,
        push: false,
        dropQueued: false,
      };
    case "CONCURRENT": {
      const merged = mergeFields(local, remote);
      return {
        record: keepImage({
          ...merged,
          vc: bumpVC(merged.vc, deviceId),
          updatedAt: new Date(now).toISOString(),
          deviceId,
          synced: false,
        }),
        relation,
        push: true,
        dropQueued: true,
      };
    }
  }
}
