import type { NearbyAssetSource } from "@/services/capture/NearbyAssets";
import type { SpeechToText } from "@/services/capture/SpeechToText";
import type { NearbyAsset } from "@/types/Capture";

/** Metres per degree of latitude. */
const M_PER_DEG_LAT = 111_320;

export const FAKE_DUPLICATE_ID = "EP-00412";
export const FAKE_DUPLICATE_DISTANCE_M = 3.2;
export const FAKE_DICTATION = "Leaning toward the road after heavy rain.";
const DICTATION_MS = 1200;

/** The most recent 12 August at or before `now`. */
function lastTwelfthOfAugust(now: Date): number {
  const date = new Date(now.getFullYear(), 7, 12, 10, 30);
  if (date > now) date.setFullYear(date.getFullYear() - 1);
  return date.getTime();
}

/**
 * The mockup's possible duplicate for `start:mock`: a concrete pole recorded
 * 3.2 m north of wherever the surveyor stands (design/screens/Tagging form.png),
 * alongside the locally stored records.
 */
export const fakeNearbyAssetSource = ((
  at: Parameters<NearbyAssetSource>[0],
  known: readonly NearbyAsset[],
  now: Date = new Date(),
): NearbyAsset[] => {
  const fake: NearbyAsset = {
    id: FAKE_DUPLICATE_ID,
    category: "energy",
    label: "pole",
    latitude: at.latitude + FAKE_DUPLICATE_DISTANCE_M / M_PER_DEG_LAT,
    longitude: at.longitude,
    capturedAt: lastTwelfthOfAugust(now),
  };
  return [...known, fake];
}) satisfies NearbyAssetSource;

/** Voice input on emulators: "hears" the mockup's comment after a moment. */
export const fakeSpeechToText: SpeechToText = {
  isAvailable: () => true,
  async start({ onText, onEnd }) {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      onText(FAKE_DICTATION);
      onEnd();
    }, DICTATION_MS);
    return {
      stop() {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        onEnd();
      },
    };
  },
};
