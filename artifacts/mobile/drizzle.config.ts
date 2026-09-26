import { defineConfig } from "drizzle-kit";

/**
 * Forward-only migrations for the on-device database. Generate with
 * `pnpm --filter mobile db:generate`; the output in `drizzle/` is checked in
 * and applied at sign-in by db/Migrate.ts.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
});
