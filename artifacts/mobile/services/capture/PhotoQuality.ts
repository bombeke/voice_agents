import type { PhotoQuality } from "@/types/Capture";

export type PhotoQualityChecker = (imagePath: string) => Promise<PhotoQuality>;

/**
 * Blur and exposure checks (design-doc §3 step 4) aren't implemented on device
 * yet, so photos are reported as unchecked. Dev mocks install a fake checker.
 */
const unchecked: PhotoQualityChecker = async () => ({
  sharp: null,
  exposureOk: null,
});

let current: PhotoQualityChecker = unchecked;

export function checkPhotoQuality(imagePath: string): Promise<PhotoQuality> {
  return current(imagePath);
}

export function setPhotoQualityChecker(checker: PhotoQualityChecker) {
  current = checker;
}
