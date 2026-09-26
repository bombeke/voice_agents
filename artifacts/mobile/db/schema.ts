import type { AssetCategory } from "@/constants/Colors";
import type {
  CaptureRecord,
  CaptureSummary,
  CaptureSyncStatus,
} from "@/types/Capture";
import type { MapAsset } from "@/types/Map";
import type {
  MyReviewStatus,
  RejectReason,
  ReviewItem,
  ReviewOutcome,
} from "@/types/Review";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
 * The signed-in user's durable records. One encrypted database per user (see
 * db/Client.ts). Every column in a WHERE or ORDER BY has an index; the rest of
 * a row lives in its JSON `data` column. Binary data never goes in a row:
 * photos stay on the filesystem and `attachments` holds their path and hash.
 *
 * Times are epoch ms (integers), so keyset pagination compares numbers.
 */

/** Vector clock: device id → counter. */
export type VectorClock = Record<string, number>;

/**
 * One uploaded observation (a detected asset): the unit the server syncs.
 * A delete keeps the row as a tombstone (`deleted`) until the server has
 * seen it, so a pull can't bring the record back.
 */
export const observations = sqliteTable(
  "observations",
  {
    pid: text("pid").primaryKey(),
    /** The CaptureSummary this detection belongs to. */
    captureId: text("capture_id"),
    category: text("category").$type<AssetCategory>(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    capturedAt: integer("captured_at"),
    updatedAt: integer("updated_at").notNull(),
    deviceId: text("device_id").notNull(),
    vc: text("vc", { mode: "json" }).$type<VectorClock>().notNull(),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    synced: integer("synced", { mode: "boolean" }).notNull().default(false),
    syncedAt: integer("synced_at"),
    /** The full record as the server sees it (LocalPole). */
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (t) => [
    index("observations_capture_idx").on(t.captureId),
    index("observations_geo_idx").on(t.deleted, t.latitude, t.longitude),
    index("observations_synced_idx").on(t.synced),
    index("observations_updated_idx").on(t.updatedAt),
  ],
);

export type RecordScope = "mine" | "team";

/**
 * What Home, Records and the detail screen show: the user's own captures and
 * the team's records a supervisor downloaded (`scope`).
 */
export const captures = sqliteTable(
  "captures",
  {
    id: text("id").primaryKey(),
    scope: text("scope").$type<RecordScope>().notNull(),
    ownerId: text("owner_id"),
    category: text("category").$type<AssetCategory>().notNull(),
    assetId: text("asset_id"),
    capturedAt: integer("captured_at").notNull(),
    syncStatus: text("sync_status").$type<CaptureSyncStatus>().notNull(),
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    /** Lower-cased title, detail, asset code, category and owner, for search. */
    search: text("search").notNull().default(""),
    summary: text("summary", { mode: "json" })
      .$type<CaptureSummary>()
      .notNull(),
    record: text("record", { mode: "json" }).$type<CaptureRecord>(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    // Keyset pages: newest first, id breaks ties.
    index("captures_page_idx").on(t.scope, t.capturedAt, t.id),
    index("captures_status_idx").on(t.scope, t.syncStatus, t.capturedAt),
    index("captures_flagged_idx").on(t.scope, t.flagged, t.capturedAt),
    index("captures_asset_idx").on(t.assetId, t.capturedAt),
  ],
);

/** Recorded assets for the Map tab, read by bounding box. */
export const mapAssets = sqliteTable(
  "map_assets",
  {
    id: text("id").primaryKey(),
    category: text("category").$type<AssetCategory>().notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    search: text("search").notNull().default(""),
    data: text("data", { mode: "json" }).$type<MapAsset>().notNull(),
  },
  (t) => [
    index("map_assets_geo_idx").on(t.latitude, t.longitude),
    index("map_assets_category_idx").on(t.category, t.latitude, t.longitude),
    index("map_assets_seen_idx").on(t.lastSeenAt),
  ],
);

/** Records waiting for this supervisor, from downloaded batches. */
export const reviewItems = sqliteTable(
  "review_items",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id"),
    reasonKind: text("reason_kind").notNull(),
    capturedAt: integer("captured_at").notNull(),
    data: text("data", { mode: "json" }).$type<ReviewItem>().notNull(),
  },
  (t) => [
    index("review_items_page_idx").on(t.capturedAt, t.id),
    index("review_items_reason_idx").on(t.reasonKind, t.capturedAt),
  ],
);

/** A supervisor's decisions, pending until the outbox delivers them. */
export const reviewDecisions = sqliteTable(
  "review_decisions",
  {
    itemId: text("item_id").primaryKey(),
    captureId: text("capture_id"),
    outcome: text("outcome").$type<ReviewOutcome>().notNull(),
    rejectReason: text("reject_reason").$type<RejectReason>(),
    decidedAt: integer("decided_at").notNull(),
    syncStatus: text("sync_status").$type<CaptureSyncStatus>().notNull(),
  },
  (t) => [index("review_decisions_status_idx").on(t.syncStatus, t.decidedAt)],
);

/** The server's verdict on the user's own routed records. */
export const reviewStatus = sqliteTable(
  "review_status",
  {
    captureId: text("capture_id").primaryKey(),
    state: text("state").$type<MyReviewStatus["state"]>().notNull(),
    data: text("data", { mode: "json" }).$type<MyReviewStatus>().notNull(),
  },
  (t) => [index("review_status_state_idx").on(t.state)],
);

/** GPS track recorder points. */
export const trackPoints = sqliteTable(
  "track_points",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    timestamp: integer("timestamp").notNull(),
  },
  (t) => [index("track_points_ts_idx").on(t.timestamp)],
);

/** DHIS2 events kept from older builds. */
export const dhis2Events = sqliteTable(
  "dhis2_events",
  {
    localId: text("local_id").primaryKey(),
    updatedAt: integer("updated_at").notNull(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (t) => [index("dhis2_events_updated_idx").on(t.updatedAt)],
);

/** Local changes for support and debugging; trimmed to the newest rows. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }),
    ts: integer("ts").notNull(),
  },
  (t) => [index("audit_log_ts_idx").on(t.ts)],
);

export type OutboxEntity = "observation" | "review_decision";
export type OutboxOp = "insert" | "update" | "delete";
/** `failed`: the server refused it for good; kept so nothing is silently lost. */
export type OutboxState = "pending" | "failed";

/**
 * Local changes waiting for the server. Written in the same transaction as
 * the change itself; the drain worker delivers them oldest first.
 */
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    entity: text("entity").$type<OutboxEntity>().notNull(),
    entityId: text("entity_id").notNull(),
    op: text("op").$type<OutboxOp>().notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    lastError: text("last_error"),
    state: text("state").$type<OutboxState>().notNull().default("pending"),
    /** HTTP status of the last refusal. */
    lastStatus: integer("last_status"),
  },
  (t) => [
    index("outbox_due_idx").on(t.state, t.nextAttemptAt, t.createdAt),
    index("outbox_entity_idx").on(t.entity, t.entityId),
    uniqueIndex("outbox_idempotency_idx").on(t.idempotencyKey),
  ],
);

/** Per collection: where the delta pull resumes, and when it last finished. */
export const syncState = sqliteTable("sync_state", {
  collection: text("collection").primaryKey(),
  serverCursor: text("server_cursor"),
  lastSyncedAt: integer("last_synced_at"),
  meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
});

export type AttachmentState = "pending" | "uploading" | "uploaded" | "failed";

/** Photos waiting to upload. The file stays on disk; the row points at it. */
export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    localPath: text("local_path").notNull(),
    /** Hex SHA-256; empty until the worker hashes the file before uploading. */
    sha256: text("sha256").notNull().default(""),
    byteSize: integer("byte_size").notNull().default(0),
    remoteUrl: text("remote_url"),
    state: text("state").$type<AttachmentState>().notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    /** The server's resumable upload session, once started. */
    uploadId: text("upload_id"),
    /** Bytes the server has confirmed; the next chunk starts here. */
    bytesSent: integer("bytes_sent").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("attachments_due_idx").on(t.state, t.nextAttemptAt, t.createdAt),
    index("attachments_entity_idx").on(t.entityId),
    uniqueIndex("attachments_entity_file_idx").on(t.entityId, t.localPath),
  ],
);

/** Every table, for live-query subscriptions by name. */
export const TABLES = {
  observations: "observations",
  captures: "captures",
  mapAssets: "map_assets",
  reviewItems: "review_items",
  reviewDecisions: "review_decisions",
  reviewStatus: "review_status",
  trackPoints: "track_points",
  dhis2Events: "dhis2_events",
  auditLog: "audit_log",
  outbox: "outbox",
  syncState: "sync_state",
  attachments: "attachments",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
