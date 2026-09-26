import { attachments, outbox } from "@/db/schema";
import { setupTestDatabase } from "@/db/testing/TestDb";
import {
  completeUpload,
  putChunk,
  resetSyncServer,
  startUpload,
  uploadStatus,
} from "@/mocks/syncServer";
import { saveObservations } from "@/services/storage/repos/ObservationRepo";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  drainAttachments,
  type FileSource,
  type UploadTransport,
} from "../AttachmentWorker";

const NOW = 1_790_000_000_000;
const PHOTO = "file:///docs/captures/1.jpg";
const BYTES = new Uint8Array(150 * 1024).map((_, i) => i % 251); // 150 KB: three 64 KB chunks

const getDb = setupTestDatabase();

const files: FileSource = {
  size: async (p) => (p === PHOTO ? BYTES.length : null),
  sha256: async () => createHash("sha256").update(BYTES).digest("hex"),
  read: async (_p, offset, length) => BYTES.slice(offset, offset + length),
};

const httpError = (status?: number) =>
  Object.assign(new Error("HTTP"), status ? { response: { status } } : {});

/** The dev fake server as a transport; `dropAfterChunks` simulates a lost connection. */
function fakeTransport({ dropAfterChunks = Infinity } = {}) {
  let chunks = 0;
  const t: UploadTransport & { chunks: () => number } = {
    start: async (args) => startUpload(args),
    status: async (id) => {
      const s = uploadStatus(id);
      if (!s) throw httpError(404);
      return s;
    },
    putChunk: async (id, offset, bytes) => {
      if (chunks >= dropAfterChunks) throw httpError(); // offline
      chunks++;
      const r = putChunk(id, offset, bytes.length);
      if (r.status !== 200) throw httpError(r.status);
      return { offset: r.offset };
    },
    complete: async (id, sha) => {
      const r = completeUpload(id, sha);
      if (r.status !== 200) throw httpError(r.status);
      return { url: r.url! };
    },
    chunks: () => chunks,
  };
  return t;
}

async function savePole(pid = "p1") {
  await getDb().write((tx) =>
    saveObservations(
      tx,
      [{ pid, latitude: 1, longitude: 2, imageUri: PHOTO }],
      { deviceId: "dev", now: NOW },
    ),
  );
}
/** The observation's JSON has been delivered, so its photo may go. */
const deliverJson = () => getDb().write((tx) => tx.delete(outbox));
const photo = async () => (await getDb().orm.select().from(attachments))[0];

beforeEach(() => resetSyncServer());

it("waits until the record's JSON has been delivered (JSON first, then photos)", async () => {
  await savePole();
  const t = fakeTransport();
  await drainAttachments(getDb(), files, t, { now: () => NOW });
  expect(t.chunks()).toBe(0);
  expect((await photo()).state).toBe("pending");
});

it("uploads in chunks, checks the hash and stores the file's URL", async () => {
  await savePole();
  await deliverJson();
  const t = fakeTransport();
  const result = await drainAttachments(getDb(), files, t, { now: () => NOW });

  expect(result).toMatchObject({ uploaded: 1, failed: 0, deferred: false });
  expect(t.chunks()).toBe(3);
  const row = await photo();
  expect(row).toMatchObject({
    state: "uploaded",
    bytesSent: BYTES.length,
    byteSize: BYTES.length,
  });
  expect(row.remoteUrl).toMatch(
    /^https:\/\/files\.example\.test\/[0-9a-f]{64}\.jpg$/,
  );
});

it("resumes after a dropped connection from the server's offset, not from zero", async () => {
  await savePole();
  await deliverJson();
  const first = fakeTransport({ dropAfterChunks: 1 });
  const cut = await drainAttachments(getDb(), files, first, {
    now: () => NOW,
    random: () => 0,
  });
  expect(cut.deferred).toBe(true);
  const halfway = await photo();
  expect(halfway).toMatchObject({
    state: "uploading",
    bytesSent: 64 * 1024,
    attemptCount: 1,
  });
  expect(halfway.nextAttemptAt).toBe(NOW + 2_500);

  // Later (a new worker, as after a restart): two chunks left, not three.
  const second = fakeTransport();
  await drainAttachments(getDb(), files, second, { now: () => NOW + 3_000 });
  expect(second.chunks()).toBe(2);
  expect((await photo()).state).toBe("uploaded");
});

it("doesn't upload a photo the server already has (same hash)", async () => {
  await savePole("p1");
  await savePole("p2"); // a second detection in the same photo
  await deliverJson();
  const t = fakeTransport();
  await drainAttachments(getDb(), files, t, { now: () => NOW });
  expect(t.chunks()).toBe(3);
  const rows = await getDb().orm.select().from(attachments);
  expect(rows.map((r) => r.state)).toEqual(["uploaded", "uploaded"]);
});

it("marks a photo whose file is gone as failed instead of retrying forever", async () => {
  await savePole();
  await deliverJson();
  await getDb().write((tx) =>
    tx
      .update(attachments)
      .set({ localPath: "file:///gone.jpg" })
      .where(eq(attachments.entityId, "p1")),
  );
  const result = await drainAttachments(getDb(), files, fakeTransport(), {
    now: () => NOW,
  });
  expect(result.failed).toBe(1);
  expect(await photo()).toMatchObject({
    state: "failed",
    lastError: "Photo file is missing",
  });
});

it("waits while photos aren't allowed (e.g. Wi-Fi only on mobile data)", async () => {
  await savePole();
  await deliverJson();
  const t = fakeTransport();
  await drainAttachments(getDb(), files, t, {
    now: () => NOW,
    canUpload: () => false,
  });
  expect(t.chunks()).toBe(0);
});
