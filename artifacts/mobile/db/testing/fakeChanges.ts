import type { ChangesPage } from "@/services/sync/Endpoints";

/* Test-only: a deterministic server change log for pull tests. */

export const remotePid = (i: number) => `r-${String(i).padStart(6, "0")}`;

/** The i-th change: an observation from another device, cursor = its 1-based position. */
export function remoteChange(i: number) {
  return {
    pid: remotePid(i),
    category: "energy",
    label: "pole",
    latitude: 0.3 + (i % 1000) * 1e-5,
    longitude: 32.5 + Math.floor(i / 1000) * 1e-5,
    timestamp: 1_790_000_000_000 + i,
    statuses: ["good"],
    updatedAt: new Date(1_790_000_000_000 + i).toISOString(),
    deviceId: "dev-server",
    vc: { "dev-server": 1 },
  };
}

/** A paging `fetchPage` over `total` changes; the cursor is the last position sent. */
export function fakeChangeFeed(total: number) {
  return async (cursor: string | null, limit: number): Promise<ChangesPage> => {
    const from = cursor ? Number(cursor) : 0;
    const to = Math.min(total, from + limit);
    const items = [];
    for (let i = from; i < to; i++) items.push(remoteChange(i));
    return {
      items,
      nextCursor: to > from ? String(to) : cursor,
      hasMore: to < total,
    };
  };
}
