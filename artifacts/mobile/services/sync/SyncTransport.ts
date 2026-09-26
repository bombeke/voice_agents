import { observations } from "@/db/schema";
import { axiosClient } from "@/services/Api";
import { refreshCaptureStatus } from "@/services/storage/repos/CaptureRepo";
import { setDecisionStatus } from "@/services/storage/repos/ReviewRepo";
import { toFileUri } from "@/services/storage/ImageStore";
import { updatedAtMs } from "@/services/sync/ConflictResolver";
import type { Orm } from "@/db/Database";
import { and, eq } from "drizzle-orm";
import { File } from "expo-file-system";
import { sha256 } from "js-sha256";
import type { FileSource, UploadTransport } from "./AttachmentWorker";
import {
  OBSERVATIONS_CHANGES_URL,
  OBSERVATIONS_PUSH_URL,
  UPLOADS_URL,
  uploadUrl,
  type ChangesPage,
  type UploadSession,
} from "./Endpoints";
import type { OutboxRow } from "./Outbox";
import type { OutboxHandlers, SendOutcome } from "./OutboxWorker";
import type { FetchChanges } from "./PullSync";
import { reviewDecisionUrl } from "./ReviewSync";

const UPLOAD_TIMEOUT_MS = 60_000;

async function captureOfPole(tx: Orm, pid: string) {
  const [row] = await tx
    .select({ captureId: observations.captureId })
    .from(observations)
    .where(eq(observations.pid, pid));
  return row?.captureId ?? null;
}

/** Sends one observation; photos go separately through the attachment worker. */
async function pushObservation(row: OutboxRow) {
  const formData = new FormData();
  const { imageUri: _local, ...metadata } = row.payload as Record<
    string,
    unknown
  >;
  formData.append("metadata", JSON.stringify(metadata));
  // The client default is application/json, which makes axios JSON-serialise
  // the FormData. multipart/form-data lets RN set the boundary.
  await axiosClient.post(OBSERVATIONS_PUSH_URL, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      "Idempotency-Key": row.idempotencyKey,
    },
    timeout: UPLOAD_TIMEOUT_MS,
  });
}

/** Refused decisions (e.g. another supervisor decided first) are kept to show. */
const classifyDecision = (err: unknown): SendOutcome => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (!status || status >= 500 || [401, 403, 408, 425, 429].includes(status)) {
    return "retry";
  }
  return "fail";
};

export const outboxHandlers: OutboxHandlers = {
  observation: {
    send: pushObservation,
    async onDelivered(tx, row, now) {
      const sentAt = updatedAtMs(row.payload as { updatedAt?: string });
      // Only the version that was sent is synced; a newer local edit is not.
      await tx
        .update(observations)
        .set({ synced: true, syncedAt: now })
        .where(
          and(
            eq(observations.pid, row.entityId),
            eq(observations.updatedAt, sentAt),
          ),
        );
      const captureId = await captureOfPole(tx, row.entityId);
      if (captureId) await refreshCaptureStatus(tx, [captureId]);
    },
    async onRefused(tx, row) {
      const captureId = await captureOfPole(tx, row.entityId);
      if (captureId) await refreshCaptureStatus(tx, [captureId]);
    },
  },
  review_decision: {
    async send(row) {
      const { captureId, outcome, rejectReason, decidedAt } =
        row.payload as Record<string, unknown>;
      // Items from before batches existed don't name a server record.
      if (!captureId) return;
      await axiosClient.patch(
        reviewDecisionUrl(String(captureId)),
        { outcome, rejectReason, decidedAt },
        { headers: { "Idempotency-Key": row.idempotencyKey } },
      );
    },
    classify: classifyDecision,
    onDelivered: (tx, row) => setDecisionStatus(tx, row.entityId, "synced"),
    onRefused: (tx, row) => setDecisionStatus(tx, row.entityId, "failed"),
  },
};

export const fetchChangesPage: FetchChanges = async (cursor, limit) => {
  const { data } = await axiosClient.get<ChangesPage>(
    OBSERVATIONS_CHANGES_URL,
    {
      params: { ...(cursor ? { cursor } : {}), limit },
    },
  );
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Unexpected changes response");
  }
  return data;
};

const HASH_CHUNK = 256 * 1024;

export const deviceFiles: FileSource = {
  async size(path) {
    try {
      const file = new File(toFileUri(path)!);
      return file.exists ? file.size : null;
    } catch {
      return null;
    }
  },
  async sha256(path) {
    const handle = new File(toFileUri(path)!).open();
    try {
      const hash = sha256.create();
      const size = handle.size ?? 0;
      handle.offset = 0;
      for (let read = 0; read < size; read += HASH_CHUNK) {
        hash.update(handle.readBytes(Math.min(HASH_CHUNK, size - read)));
      }
      return hash.hex();
    } finally {
      handle.close();
    }
  },
  async read(path, offset, length) {
    const handle = new File(toFileUri(path)!).open();
    try {
      handle.offset = offset;
      return handle.readBytes(length);
    } finally {
      handle.close();
    }
  },
};

export const uploadTransport: UploadTransport = {
  async start(args) {
    const { data } = await axiosClient.post<UploadSession>(UPLOADS_URL, {
      ...args,
      contentType: "image/jpeg",
    });
    return data;
  },
  async status(uploadId) {
    const { data } = await axiosClient.get<{
      offset: number;
      chunkSize?: number;
    }>(uploadUrl(uploadId));
    return data;
  },
  async putChunk(uploadId, offset, bytes, total) {
    const { data } = await axiosClient.put<{ offset: number }>(
      `${uploadUrl(uploadId)}/chunks`,
      bytes,
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": `bytes ${offset}-${offset + bytes.length - 1}/${total}`,
        },
        timeout: UPLOAD_TIMEOUT_MS,
      },
    );
    return data;
  },
  async complete(uploadId, hash) {
    const { data } = await axiosClient.post<{ url: string }>(
      `${uploadUrl(uploadId)}/complete`,
      {
        sha256: hash,
      },
    );
    return data;
  },
};
