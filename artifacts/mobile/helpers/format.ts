/** Fills `{name}` placeholders in an externalised string. */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** 142 → "142° SE". Headings are degrees from true north. */
export function formatHeading(degrees: number): string {
  const normalised = ((Math.round(degrees) % 360) + 360) % 360;
  const point = COMPASS_POINTS[Math.round(normalised / 45) % 8];
  return `${normalised}° ${point}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "09:05" (local time, 24 h). */
export function formatClock(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
