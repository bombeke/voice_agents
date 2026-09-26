import type { Orm } from "@/db/Database";
import { mapAssets } from "@/db/schema";
import type { MapAsset, MapCategoryFilter } from "@/types/Map";
import { and, between, desc, eq, sql } from "drizzle-orm";

/** [west, south, east, north], as MapLibre reports the viewport. */
export type Bounds = [number, number, number, number];

const EXCLUDED = (col: string) => sql.raw(`excluded.${col}`);

const assetSearch = (a: MapAsset) =>
  [a.id, a.title, a.label].filter(Boolean).join(" ").toLowerCase();

/** Adds or replaces assets by id (a re-captured asset replaces its pin). */
export async function upsertAssets(tx: Orm, assets: readonly MapAsset[]) {
  for (let i = 0; i < assets.length; i += 200) {
    await tx
      .insert(mapAssets)
      .values(
        assets.slice(i, i + 200).map((a) => ({
          id: a.id,
          category: a.category,
          latitude: a.latitude,
          longitude: a.longitude,
          lastSeenAt: a.lastSeenAt,
          search: assetSearch(a),
          data: a,
        })),
      )
      .onConflictDoUpdate({
        target: mapAssets.id,
        set: {
          category: EXCLUDED("category"),
          latitude: EXCLUDED("latitude"),
          longitude: EXCLUDED("longitude"),
          lastSeenAt: EXCLUDED("last_seen_at"),
          search: EXCLUDED("search"),
          data: EXCLUDED("data"),
        },
      });
  }
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Pins for the map: the category chip, the search text, and the viewport
 * (an indexed box) when known. Capped, newest first: clustering shows the
 * rest as counts once the user zooms in.
 */
export async function assetsInView(
  orm: Orm,
  {
    category,
    query,
    bounds,
    limit = 3000,
  }: {
    category: MapCategoryFilter;
    query: string;
    bounds: Bounds | null;
    limit?: number;
  },
): Promise<MapAsset[]> {
  const q = query.trim().toLowerCase();
  const rows = await orm
    .select({ data: mapAssets.data })
    .from(mapAssets)
    .where(
      and(
        category === "all" ? undefined : eq(mapAssets.category, category),
        bounds ? between(mapAssets.latitude, bounds[1], bounds[3]) : undefined,
        bounds ? between(mapAssets.longitude, bounds[0], bounds[2]) : undefined,
        q
          ? sql`${mapAssets.search} LIKE ${`%${likeEscape(q)}%`} ESCAPE '\\'`
          : undefined,
      ),
    )
    .orderBy(desc(mapAssets.lastSeenAt))
    .limit(limit);
  return rows.map((r) => r.data);
}

export async function assetCount(orm: Orm): Promise<number> {
  const [row] = await orm.select({ n: sql<number>`count(*)` }).from(mapAssets);
  return Number(row?.n ?? 0);
}

export async function getAsset(orm: Orm, id: string): Promise<MapAsset | null> {
  const [row] = await orm
    .select({ data: mapAssets.data })
    .from(mapAssets)
    .where(eq(mapAssets.id, id));
  return row?.data ?? null;
}

/** `[west, south, east, north]` around every asset, from the indexes; null when there are none. */
export async function assetExtent(orm: Orm): Promise<Bounds | null> {
  const [row] = await orm
    .select({
      west: sql<number | null>`min(${mapAssets.longitude})`,
      south: sql<number | null>`min(${mapAssets.latitude})`,
      east: sql<number | null>`max(${mapAssets.longitude})`,
      north: sql<number | null>`max(${mapAssets.latitude})`,
    })
    .from(mapAssets);
  if (!row || row.west === null) return null;
  return [
    Number(row.west),
    Number(row.south),
    Number(row.east),
    Number(row.north),
  ];
}
