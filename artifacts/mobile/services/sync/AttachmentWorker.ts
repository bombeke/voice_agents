import type { Database } from "@/db/Database";
import { attachments, observations, outbox } from "@/db/schema";
import { refreshCaptureStatus } from "@/services/storage/repos/CaptureRepo";
import { and, asc, eq, gt, inArray, lte, min, notExists } from "drizzle-orm";
import { nextAttemptAt } from "./Backoff";
import type { UploadSession } from "./Endpoints";
import { errorMessage } from "./OutboxWorker";

export type AttachmentRow = typeof attachments.$inferSelect;

/** Reads photo files; the device uses expo-file-system, tests an in-memory map. */
export interface FileSource {
  /** Byte size, or null when the file is gone. */
  size(path: string): Promise<number | null>;
  sha256(path: string): Promise<string>;
  read(path: string, offset: number, length: number): Promise<Uint8Array>;
}

/** The resumable upload endpoints (see Endpoints.ts). */
export interface UploadTransport {
  start(args: {
    entityId: string;
    sha256: string;
    byteSize: number;
    fileName: string;
  }): Promise<UploadSession>;
  /** Bytes the server holds for this session, and its chunk size. Throws with status 404 once it expired. */
  status(uploadId: string): Promise<{ offset: number; chunkSize?: number }>;
  putChunk(
    uploadId: string,
    offset: number,
    bytes: Uint8Array,
    total: number,
  ): Promise<{ offset: number }>;
  complete(uploadId: string, sha256: string): Promise<{ url: string }>;
}

export interface AttachmentDrainResult {
  uploaded: number;
  failed: number;
  deferred: boolean;
  nextDueAt: number | null;
}

const DEFAULT_CHUNK = 256 * 1024;

const statusOf = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

const retryable = (err: unknown) => {
  const s = statusOf(err);
  return !s || s >= 500 || [401, 403, 408, 425, 429].includes(s);
};

const fileName = (path: string) => path.split("/").pop() || "photo.jpg";

async function captureOf(db: Database, entityId: string) {
  const [row] = await db.orm
    .select({ captureId: observations.captureId })
    .from(observations)
    .where(eq(observations.pid, entityId));
  return row?.captureId ?? null;
}

/**
 * Uploads due photos, oldest first, a chunk at a time. Progress (session id
 * and confirmed bytes) is committed after every chunk, and on restart the
 * server's own offset wins, so a kill or a dropped connection resumes where
 * the server stopped, not from zero. A retryable failure backs off (stored in
 * `next_attempt_at`) and ends the run.
 */
export async function drainAttachments(
  db: Database,
  files: FileSource,
  transport: UploadTransport,
  {
    now = Date.now,
    random = Math.random,
    canUpload = () => true,
  }: {
    now?: () => number;
    random?: () => number;
    canUpload?: () => boolean;
  } = {},
): Promise<AttachmentDrainResult> {
  let uploaded = 0;
  let failed = 0;

  const settle = async (row: AttachmentRow, set: Partial<AttachmentRow>) => {
    const captureId = await captureOf(db, row.entityId);
    await db.write(async (tx) => {
      await tx.update(attachments).set(set).where(eq(attachments.id, row.id));
      if (captureId) await refreshCaptureStatus(tx, [captureId]);
    });
  };

  while (canUpload()) {
    const [row] = await db.orm
      .select()
      .from(attachments)
      .where(
        and(
          inArray(attachments.state, ["pending", "uploading"]),
          lte(attachments.nextAttemptAt, now()),
          // JSON first, then photos (design-doc §9.1).
          notExists(
            db.orm
              .select({ id: outbox.id })
              .from(outbox)
              .where(
                and(
                  eq(outbox.entity, "observation"),
                  eq(outbox.entityId, attachments.entityId),
                  eq(outbox.state, "pending"),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(attachments.createdAt), asc(attachments.id))
      .limit(1);
    if (!row) break;

    try {
      const size = await files.size(row.localPath);
      if (size === null) {
        await settle(row, {
          state: "failed",
          lastError: "Photo file is missing",
        });
        failed++;
        continue;
      }

      let { sha256, uploadId, bytesSent } = row;
      if (!sha256 || row.byteSize !== size) {
        sha256 = await files.sha256(row.localPath);
        await db.write((tx) =>
          tx
            .update(attachments)
            .set({ sha256, byteSize: size })
            .where(eq(attachments.id, row.id)),
        );
      }

      let chunkSize = DEFAULT_CHUNK;
      if (uploadId) {
        try {
          const status = await transport.status(uploadId);
          bytesSent = status.offset;
          chunkSize = status.chunkSize || DEFAULT_CHUNK;
        } catch (err) {
          if (statusOf(err) !== 404) throw err;
          uploadId = null; // Session expired: start over.
        }
      }
      if (!uploadId) {
        const session = await transport.start({
          entityId: row.entityId,
          sha256,
          byteSize: size,
          fileName: fileName(row.localPath),
        });
        if (session.complete && session.url) {
          await settle(row, {
            state: "uploaded",
            remoteUrl: session.url,
            bytesSent: size,
            lastError: null,
          });
          uploaded++;
          continue;
        }
        uploadId = session.uploadId;
        bytesSent = session.offset;
        chunkSize = session.chunkSize || DEFAULT_CHUNK;
      }
      await db.write((tx) =>
        tx
          .update(attachments)
          .set({ uploadId, bytesSent, state: "uploading" })
          .where(eq(attachments.id, row.id)),
      );

      while (bytesSent < size) {
        const bytes = await files.read(
          row.localPath,
          bytesSent,
          Math.min(chunkSize, size - bytesSent),
        );
        const { offset } = await transport.putChunk(
          uploadId!,
          bytesSent,
          bytes,
          size,
        );
        bytesSent = offset;
        await db.write((tx) =>
          tx
            .update(attachments)
            .set({ bytesSent })
            .where(eq(attachments.id, row.id)),
        );
      }
      const { url } = await transport.complete(uploadId!, sha256);
      await settle(row, {
        state: "uploaded",
        remoteUrl: url,
        bytesSent: size,
        lastError: null,
      });
      uploaded++;
    } catch (err) {
      const attempt = row.attemptCount + 1;
      if (retryable(err)) {
        await db.write((tx) =>
          tx
            .update(attachments)
            .set({
              attemptCount: attempt,
              nextAttemptAt: nextAttemptAt(attempt, now(), random),
              lastError: errorMessage(err),
            })
            .where(eq(attachments.id, row.id)),
        );
        return {
          uploaded,
          failed,
          deferred: true,
          nextDueAt: await nextDue(db),
        };
      }
      await settle(row, {
        state: "failed",
        attemptCount: attempt,
        lastError: errorMessage(err),
      });
      failed++;
    }
  }
  return { uploaded, failed, deferred: false, nextDueAt: await nextDue(db) };
}

async function nextDue(db: Database): Promise<number | null> {
  const [row] = await db.orm
    .select({ at: min(attachments.nextAttemptAt) })
    .from(attachments)
    .where(inArray(attachments.state, ["pending", "uploading"]));
  return row?.at ?? null;
}

/** "Sync now": failed photos get another go and backed-off ones are due now. */
export async function retryFailedAttachments(db: Database, now = Date.now()) {
  await db.write(async (tx) => {
    await tx
      .update(attachments)
      .set({ state: "pending", nextAttemptAt: now, attemptCount: 0 })
      .where(eq(attachments.state, "failed"));
    await tx
      .update(attachments)
      .set({ nextAttemptAt: now })
      .where(
        and(
          inArray(attachments.state, ["pending", "uploading"]),
          gt(attachments.nextAttemptAt, now),
        ),
      );
  });
}
