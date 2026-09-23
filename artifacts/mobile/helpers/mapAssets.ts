import type { ChipTone } from "@/components/ui/Chip";
import { strings } from "@/constants/Strings";
import { formatAttributeValue } from "@/helpers/detectionReview";
import { distanceM } from "@/helpers/duplicateCheck";
import { fill, formatClock, isSameLocalDay } from "@/helpers/format";
import type { AssetStatus, AttributeKey } from "@/types/Capture";
import type { MapAsset, MapCategoryFilter } from "@/types/Map";

interface Position {
  latitude: number;
  longitude: number;
}

/** Properties each pin carries into MapLibre (kept small: the bridge copies them). */
export interface AssetFeatureProps {
  id: string;
  category: MapAsset["category"];
}

/** Category chip, then a case-insensitive match on the asset code, name or class. */
export function filterAssets(
  assets: readonly MapAsset[],
  category: MapCategoryFilter,
  query: string,
): MapAsset[] {
  const q = query.trim().toLowerCase();
  return assets.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (!q ||
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.label.toLowerCase().includes(q)),
  );
}

export interface AssetFeature {
  type: "Feature";
  id: string;
  properties: AssetFeatureProps;
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface AssetFeatureCollection {
  type: "FeatureCollection";
  features: AssetFeature[];
}

export function toFeatureCollection(
  assets: readonly MapAsset[],
): AssetFeatureCollection {
  return {
    type: "FeatureCollection",
    features: assets.map((a) => ({
      type: "Feature",
      id: a.id,
      properties: { id: a.id, category: a.category },
      geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
    })),
  };
}

/** 38 → "38 m"; 1240 → "1.2 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) {
    return fill(strings.map.asset.metres, { value: Math.round(metres) });
  }
  return fill(strings.map.asset.kilometres, {
    value: (metres / 1000).toFixed(1),
  });
}

/** "12 Aug 2026" (local date). */
export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "today 10:14" for today, otherwise "12 Aug 2026". */
export function formatLastSeen(
  epochMs: number,
  now: Date = new Date(),
): string {
  const at = new Date(epochMs);
  if (isSameLocalDay(at, now)) {
    return fill(strings.map.asset.today, {
      time: formatClock(at),
    });
  }
  return formatDate(epochMs);
}

/** "EP-00412 · last seen today 10:14 · 38 m away"; no distance without a fix. */
export function formatAssetMeta(
  asset: MapAsset,
  from: Position | null,
  now: Date = new Date(),
): string {
  const parts = [
    fill(strings.map.asset.meta, {
      id: asset.id,
      when: formatLastSeen(asset.lastSeenAt, now),
    }),
  ];
  if (from) {
    parts.push(
      fill(strings.map.asset.away, {
        distance: formatDistance(distanceM(from, asset)),
      }),
    );
  }
  return parts.join(" · ");
}

export function attributeValue(
  asset: MapAsset,
  key: AttributeKey,
): string | null {
  return asset.attributes.find((a) => a.key === key)?.value ?? null;
}

const STATUS_TONE: Record<AssetStatus, ChipTone> = {
  good: "success",
  inclined: "warning",
  vegetation: "warning",
  rust: "warning",
  leaking: "warning",
  eroded: "warning",
  under_construction: "neutral",
  cracked: "danger",
  sagging_lines: "danger",
  blocked: "danger",
  potholes: "danger",
  vandalised: "danger",
};

export interface ConditionChip {
  label: string;
  tone: ChipTone;
}

/**
 * The asset's condition as chips, e.g. "Inclined 7°", "Vegetation: partial".
 * Statuses with a measured attribute show the value; partial vegetation is
 * still acceptable, so only heavy cover is a warning.
 */
export function conditionChips(asset: MapAsset): ConditionChip[] {
  return asset.statuses.map((status) => {
    if (status === "inclined") {
      const degrees = attributeValue(asset, "inclination");
      if (degrees) {
        return {
          label: fill(strings.map.asset.inclined, { value: degrees }),
          tone: STATUS_TONE.inclined,
        };
      }
    }
    if (status === "vegetation") {
      const cover = attributeValue(asset, "vegetationCover");
      const text = formatAttributeValue("vegetationCover", cover);
      if (cover && text) {
        return {
          label: fill(strings.map.asset.vegetation, {
            value: text.toLowerCase(),
          }),
          tone: cover === "heavy" ? "warning" : "success",
        };
      }
    }
    return {
      label: strings.capture.statuses[status],
      tone: STATUS_TONE[status],
    };
  });
}

/** `[west, south, east, north]` around every asset; null when there are none. */
export function assetBounds(
  assets: readonly MapAsset[],
): [number, number, number, number] | null {
  if (assets.length === 0) return null;
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const a of assets) {
    west = Math.min(west, a.longitude);
    east = Math.max(east, a.longitude);
    south = Math.min(south, a.latitude);
    north = Math.max(north, a.latitude);
  }
  return [west, south, east, north];
}
