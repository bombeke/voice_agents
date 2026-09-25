import type { CaptureSummary, Enumerator } from "@/types/Capture";
import type { MapAsset } from "@/types/Map";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewBatchResponse,
  ReviewItem,
  ReviewOutcome,
  ReviewReason,
  TeamRecord,
} from "@/types/Review";
import { createMMKV } from "react-native-mmkv";
import { fakeCaptures } from "./captures";
import { FAKE_USERS } from "./fixtures";
import { fakeRecordFor } from "./records";

/** The field user from fixtures.ts: their flagged culvert is in the queue. */
const FIELD_USER = FAKE_USERS[0];
const FIELD: Enumerator = { id: FIELD_USER.username, name: FIELD_USER.name };

const enumerator = (n: string): Enumerator => ({
  id: `enumerator-${n}`,
  name: `Enumerator ${n}`,
});

interface Row {
  category: CaptureSummary["category"];
  title: string;
  owner: Enumerator;
  reason: ReviewReason;
  accuracyM: number;
  /** Hours before now; ignored for the field user's own capture. */
  hoursAgo: number;
}

/**
 * The records routed to the supervisor. The first four are
 * design/screens/Supervisor review.png (its culvert is the field user's own
 * flagged capture, so a decision reaches their Review tab); the rest come in
 * the next batch.
 */
const ROWS: Row[] = [
  {
    category: "roads",
    title: "Culvert · pipe",
    owner: FIELD,
    reason: { kind: "low_confidence", confidence: 0.52 },
    accuracyM: 3.6,
    hoursAgo: 1,
  },
  {
    category: "water",
    title: "Public tap",
    owner: enumerator("02"),
    reason: { kind: "gps_unverified", accuracyM: 6.1 },
    accuracyM: 6.1,
    hoursAgo: 2,
  },
  {
    category: "energy",
    title: "Transformer",
    owner: enumerator("04"),
    reason: { kind: "heavy_edits", edited: 4, total: 6 },
    accuracyM: 2.4,
    hoursAgo: 26,
  },
  {
    category: "telecom",
    title: "Telecom pole",
    owner: enumerator("07"),
    reason: { kind: "duplicate", distanceM: 1.8 },
    accuracyM: 1.9,
    hoursAgo: 28,
  },
  {
    category: "energy",
    title: "Street light",
    owner: enumerator("02"),
    reason: { kind: "low_confidence", confidence: 0.47 },
    accuracyM: 3.2,
    hoursAgo: 30,
  },
  {
    category: "water",
    title: "Borehole · hand pump",
    owner: enumerator("07"),
    reason: { kind: "gps_unverified", accuracyM: 5.4 },
    accuracyM: 5.4,
    hoursAgo: 49,
  },
  {
    category: "roads",
    title: "Pothole",
    owner: enumerator("04"),
    reason: { kind: "duplicate", distanceM: 2.6 },
    accuracyM: 2.9,
    hoursAgo: 52,
  },
];

/** Items per download, so "Download next batch" has something to fetch. */
export const MOCK_BATCH_PAGE = 4;

interface ServerDecision {
  outcome: ReviewOutcome;
  rejectReason?: RejectReason;
  decidedAt: string;
}

interface ServerState {
  /** Item ids already sent to a supervisor. */
  served: string[];
  /** By record id. */
  decisions: Record<string, ServerDecision>;
}

const STATE_KEY = "state";
const storage = createMMKV({ id: "iip-dev-mock-server" });

function load(): ServerState {
  try {
    const raw = storage.getString(STATE_KEY);
    if (raw) return JSON.parse(raw) as ServerState;
  } catch {
    // Start over.
  }
  return { served: [], decisions: {} };
}

function save(state: ServerState) {
  storage.set(STATE_KEY, JSON.stringify(state));
}

/** The field user's own capture a row reviews, when it is theirs. */
function fieldCapture(row: Row, now: Date): CaptureSummary | undefined {
  if (row.owner.id !== FIELD.id) return undefined;
  return fakeCaptures(now, FIELD).find(
    (c) => c.title === row.title && c.category === row.category,
  );
}

function recordId(row: Row, i: number, now: Date): string {
  return fieldCapture(row, now)?.id ?? `team-record-${i + 1}`;
}

function teamRecord(
  row: Row,
  i: number,
  now: Date,
  assets: readonly MapAsset[],
): TeamRecord {
  const own = fieldCapture(row, now);
  const summary: CaptureSummary = own ?? {
    id: recordId(row, i, now),
    category: row.category,
    title: row.title,
    capturedAt: new Date(
      now.getTime() - row.hoursAgo * 3_600_000,
    ).toISOString(),
    accuracyM: row.accuracyM,
    syncStatus: "synced",
    flagged: true,
    capturedBy: row.owner,
  };
  return {
    summary: { ...summary, syncStatus: "synced", capturedBy: row.owner },
    record: {
      ...fakeRecordFor(summary, assets, i),
      capturedBy: row.owner,
    },
  };
}

const itemId = (i: number) => `fake-review-${i + 1}`;

/**
 * `GET /review/v1/batch`: the next routed records not yet sent, at most
 * `limit` (and a page of MOCK_BATCH_PAGE), with their details.
 */
export function nextReviewBatch(
  limit: number,
  assets: readonly MapAsset[],
  now: Date = new Date(),
): ReviewBatchResponse {
  const state = load();
  const served = new Set(state.served);
  const picked = ROWS.map((row, i) => ({ row, i }))
    .filter(({ row, i }) => {
      return !served.has(itemId(i)) && !state.decisions[recordId(row, i, now)];
    })
    .slice(0, Math.min(limit, MOCK_BATCH_PAGE));

  const records = picked.map(({ row, i }) => teamRecord(row, i, now, assets));
  const items: ReviewItem[] = picked.map(({ row, i }, n) => ({
    id: itemId(i),
    captureId: records[n].summary.id,
    category: row.category,
    title: row.title,
    enumerator: row.owner.name,
    capturedAt: records[n].summary.capturedAt,
    reason: row.reason,
  }));

  save({ ...state, served: [...state.served, ...items.map((it) => it.id)] });
  return {
    batchId: `fake-batch-${state.served.length + items.length}`,
    items,
    records,
  };
}

/** `PATCH /observations/v1/stream/{id}/review`. False: already decided. */
export function decideOnServer(id: string, decision: ServerDecision): boolean {
  const state = load();
  if (state.decisions[id]) return false;
  save({ ...state, decisions: { ...state.decisions, [id]: decision } });
  return true;
}

/** `GET /review/v1/mine`: the verdict on each of this user's routed records. */
export function myReviewStatuses(
  userId: string,
  now: Date = new Date(),
): MyReviewStatus[] {
  const { decisions } = load();
  return ROWS.flatMap((row, i): MyReviewStatus[] => {
    if (row.owner.id !== userId) return [];
    const captureId = recordId(row, i, now);
    const d = decisions[captureId];
    if (!d) return [{ captureId, state: "waiting" }];
    return [
      {
        captureId,
        state: d.outcome,
        ...(d.rejectReason ? { rejectReason: d.rejectReason } : {}),
        decidedAt: d.decidedAt,
      },
    ];
  });
}

/**
 * `GET /records/v1/team`: every record of the supervisor's enumerators, the
 * field user's captures included, as the server holds them (synced).
 */
export function teamRecords(
  assets: readonly MapAsset[],
  now: Date = new Date(),
): TeamRecord[] {
  const field = fakeCaptures(now, FIELD).map((c, i): TeamRecord => ({
    summary: { ...c, syncStatus: "synced", capturedBy: FIELD },
    record: { ...fakeRecordFor(c, assets, i), capturedBy: FIELD },
  }));
  const others = ROWS.map((row, i) => ({ row, i }))
    .filter(({ row }) => row.owner.id !== FIELD.id)
    .map(({ row, i }) => teamRecord(row, i, now, assets));
  return [...field, ...others];
}

/** Forgets every batch and decision (tests). */
export function resetReviewServer() {
  storage.remove(STATE_KEY);
}
