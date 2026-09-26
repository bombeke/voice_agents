CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`local_path` text NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`remote_url` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`upload_id` text,
	`bytes_sent` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_due_idx` ON `attachments` (`state`,`next_attempt_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `attachments_entity_idx` ON `attachments` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_entity_file_idx` ON `attachments` (`entity_id`,`local_path`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_ts_idx` ON `audit_log` (`ts`);--> statement-breakpoint
CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`owner_id` text,
	`category` text NOT NULL,
	`asset_id` text,
	`captured_at` integer NOT NULL,
	`sync_status` text NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`search` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`record` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `captures_page_idx` ON `captures` (`scope`,`captured_at`,`id`);--> statement-breakpoint
CREATE INDEX `captures_status_idx` ON `captures` (`scope`,`sync_status`,`captured_at`);--> statement-breakpoint
CREATE INDEX `captures_flagged_idx` ON `captures` (`scope`,`flagged`,`captured_at`);--> statement-breakpoint
CREATE INDEX `captures_asset_idx` ON `captures` (`asset_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `dhis2_events` (
	`local_id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dhis2_events_updated_idx` ON `dhis2_events` (`updated_at`);--> statement-breakpoint
CREATE TABLE `map_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`last_seen_at` integer NOT NULL,
	`search` text DEFAULT '' NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `map_assets_geo_idx` ON `map_assets` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `map_assets_category_idx` ON `map_assets` (`category`,`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `map_assets_seen_idx` ON `map_assets` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `observations` (
	`pid` text PRIMARY KEY NOT NULL,
	`capture_id` text,
	`category` text,
	`latitude` real,
	`longitude` real,
	`captured_at` integer,
	`updated_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`vc` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`synced` integer DEFAULT false NOT NULL,
	`synced_at` integer,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observations_capture_idx` ON `observations` (`capture_id`);--> statement-breakpoint
CREATE INDEX `observations_geo_idx` ON `observations` (`deleted`,`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `observations_synced_idx` ON `observations` (`synced`);--> statement-breakpoint
CREATE INDEX `observations_updated_idx` ON `observations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`last_status` integer
);
--> statement-breakpoint
CREATE INDEX `outbox_due_idx` ON `outbox` (`state`,`next_attempt_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbox_entity_idx` ON `outbox` (`entity`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_idempotency_idx` ON `outbox` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`item_id` text PRIMARY KEY NOT NULL,
	`capture_id` text,
	`outcome` text NOT NULL,
	`reject_reason` text,
	`decided_at` integer NOT NULL,
	`sync_status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_decisions_status_idx` ON `review_decisions` (`sync_status`,`decided_at`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`capture_id` text,
	`reason_kind` text NOT NULL,
	`captured_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_items_page_idx` ON `review_items` (`captured_at`,`id`);--> statement-breakpoint
CREATE INDEX `review_items_reason_idx` ON `review_items` (`reason_kind`,`captured_at`);--> statement-breakpoint
CREATE TABLE `review_status` (
	`capture_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_status_state_idx` ON `review_status` (`state`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`collection` text PRIMARY KEY NOT NULL,
	`server_cursor` text,
	`last_synced_at` integer,
	`meta` text
);
--> statement-breakpoint
CREATE TABLE `track_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `track_points_ts_idx` ON `track_points` (`timestamp`);