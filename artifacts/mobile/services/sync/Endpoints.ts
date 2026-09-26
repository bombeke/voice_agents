/**
 * The sync API contract. The dev fake server (mocks/syncServer.ts) answers
 * the same shapes.
 */

/** POST: one observation, multipart with a `metadata` JSON part; `Idempotency-Key` header. */
export const OBSERVATIONS_PUSH_URL = "/observations/v1/stream";

/**
 * GET `?cursor=&limit=`: observations changed after the cursor, oldest
 * change first. Deletes come as `{ pid, deleted: true, vc, updatedAt }`.
 */
export const OBSERVATIONS_CHANGES_URL = "/observations/v1/changes";

export interface ChangesPage {
  items: unknown[];
  /** Opaque; pass back to resume after this page. Null when nothing changed. */
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Resumable, chunked photo upload:
 * - POST `/uploads/v1` `{ entityId, sha256, byteSize, fileName, contentType }`
 *   → `UploadSession` (`complete` when the server already has this hash);
 * - GET `/uploads/v1/:id` → `{ offset, chunkSize }`: the bytes the server
 *   holds, to resume from;
 * - PUT `/uploads/v1/:id/chunks` with `Content-Range: bytes a-b/total` and
 *   the raw bytes → `{ offset }`;
 * - POST `/uploads/v1/:id/complete` `{ sha256 }` → `{ url }`, after the
 *   server checked the hash.
 */
export const UPLOADS_URL = "/uploads/v1";

export const uploadUrl = (id: string) =>
  `${UPLOADS_URL}/${encodeURIComponent(id)}`;

export interface UploadSession {
  uploadId: string;
  chunkSize: number;
  offset: number;
  complete?: boolean;
  url?: string;
}
