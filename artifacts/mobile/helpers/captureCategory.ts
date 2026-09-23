import type { CaptureCategory } from "@/types/Capture";

const CATEGORIES: readonly CaptureCategory[] = [
  "energy",
  "water",
  "telecom",
  "roads",
  "auto",
];

/** Reads the `?category=` route param; anything unexpected lets the AI choose. */
export function parseCaptureCategory(
  param: string | string[] | undefined,
): CaptureCategory {
  const value = Array.isArray(param) ? param[0] : param;
  return CATEGORIES.includes(value as CaptureCategory)
    ? (value as CaptureCategory)
    : "auto";
}
