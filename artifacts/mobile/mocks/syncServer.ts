import type { ChangesPage, UploadSession } from "@/services/sync/Endpoints";
import type { MapAsset } from "@/types/Map";

/*
 * Dev-only fake of the sync API (services/sync/Endpoints.ts): an in-memory
 * observation log with a change cursor, idempotent pushes, and resumable
 * chunked uploads. Pure functions over module state, so tests drive it
 * without axios.
 */

interface StoredObservation {
  record: Record<string, unknown>;
  /** Position in the change log; the cursor is the last seq a client saw. */
  seq: number;
}

interface Session {
  id: string;
  entityId: string;
  sha256: string;
  byteSize: number;
  received: number;
}

export const FAKE_CHUNK_SIZE = 64 * 1024;
const FILES_URL = "https://files.example.test";

let seq = 0;
const observations = new Map<string, StoredObservation>();
const idempotent = new Map<string, number>();
const sessions = new Map<string, Session>();
/** Uploaded files by hash: the same photo is never stored twice. */
const files = new Map<string, string>();

export function resetSyncServer() {
  seq = 0;
  observations.clear();
  idempotent.clear();
  sessions.clear();
  files.clear();
}

const store = (record: Record<string, unknown>) => {
  const pid = String(record.pid ?? record.id);
  observations.set(pid, { record: { ...record, pid }, seq: ++seq });
  return pid;
};

/**
 * Another enumerator's observations of the fake assets, so the first pull
 * brings something down (and the duplicate check has neighbours).
 */
export function seedRemoteObservations(
  assets: readonly MapAsset[],
  now = Date.now(),
) {
  if (observations.size) return;
  for (const a of assets) {
    store({
      pid: `srv-${a.id}`,
      dhis2Id: a.id,
      category: a.category,
      label: a.label,
      latitude: a.latitude,
      longitude: a.longitude,
      timestamp: a.lastSeenAt,
      statuses: a.statuses,
      functional: a.functional,
      comment: a.comment,
      updatedAt: new Date(now).toISOString(),
      deviceId: "server",
      vc: { server: 1 },
    });
  }
}

/** `POST /observations/v1/stream`: 200 either way; a replayed key changes nothing. */
export function pushObservation(
  metadata: Record<string, unknown>,
  key?: string,
): number {
  if (key && idempotent.has(key)) return 200;
  store(metadata);
  if (key) idempotent.set(key, seq);
  return 200;
}

/** `GET /observations/v1/changes`: everything after the cursor, oldest change first. */
export function changesAfter(
  cursor: string | null,
  limit: number,
): ChangesPage {
  const after = cursor ? Number(cursor) : 0;
  const pending = [...observations.values()]
    .filter((o) => o.seq > after)
    .sort((a, b) => a.seq - b.seq);
  const page = pending.slice(0, Math.max(1, limit));
  const last = page[page.length - 1];
  return {
    items: page.map((o) => o.record),
    nextCursor: last ? String(last.seq) : cursor,
    hasMore: pending.length > page.length,
  };
}

export function observationCount() {
  return observations.size;
}

export function startUpload(args: {
  entityId: string;
  sha256: string;
  byteSize: number;
}): UploadSession {
  const url = files.get(args.sha256);
  if (url)
    return {
      uploadId: "",
      chunkSize: FAKE_CHUNK_SIZE,
      offset: args.byteSize,
      complete: true,
      url,
    };
  const id = `up-${sessions.size + 1}-${args.sha256.slice(0, 8)}`;
  sessions.set(id, { id, ...args, received: 0 });
  return { uploadId: id, chunkSize: FAKE_CHUNK_SIZE, offset: 0 };
}

export function uploadStatus(
  id: string,
): { offset: number; chunkSize: number } | null {
  const s = sessions.get(id);
  return s ? { offset: s.received, chunkSize: FAKE_CHUNK_SIZE } : null;
}

/**
 * A chunk must start where the server stopped; otherwise the client is told
 * the real offset (409) and resumes from there.
 */
export function putChunk(
  id: string,
  start: number,
  length: number,
): { status: number; offset: number } {
  const s = sessions.get(id);
  if (!s) return { status: 404, offset: 0 };
  if (start !== s.received) return { status: 409, offset: s.received };
  s.received = Math.min(s.byteSize, s.received + length);
  return { status: 200, offset: s.received };
}

export function completeUpload(
  id: string,
  sha256: string,
): { status: number; url?: string } {
  const s = sessions.get(id);
  if (!s) return { status: 404 };
  if (s.received !== s.byteSize || s.sha256 !== sha256) return { status: 400 };
  const url = `${FILES_URL}/${sha256}.jpg`;
  files.set(sha256, url);
  sessions.delete(id);
  return { status: 200, url };
}

/** `Content-Range: bytes a-b/total` → a. */
export function rangeStart(header: unknown): number {
  const m = /bytes\s+(\d+)-/.exec(String(header ?? ""));
  return m ? Number(m[1]) : 0;
}

/** The byte length of a request body as axios hands it to the adapter. */
export function bodyLength(data: unknown): number {
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof data === "string") return data.length;
  return 0;
}

/** The `metadata` part of a multipart push (RN FormData keeps `_parts`). */
export function metadataOf(data: unknown): Record<string, unknown> {
  const form = data as {
    get?: (k: string) => unknown;
    _parts?: [string, unknown][];
  };
  const raw =
    form?.get?.("metadata") ??
    form?._parts?.find(([k]) => k === "metadata")?.[1] ??
    (typeof data === "string" ? data : null);
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed?.metadata && typeof parsed.metadata === "string"
      ? JSON.parse(parsed.metadata)
      : parsed;
  } catch {
    return {};
  }
}
