export function useTagDetection() {
  return { detections: [], isReady: false, error: null };
}
export function detectTags() { return Promise.resolve([]); }
export default { useTagDetection, detectTags };
