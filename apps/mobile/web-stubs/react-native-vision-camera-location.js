export function useLocationPermission() {
  return { hasPermission: false, requestPermission: async () => false };
}
export function withLocation(frameProcessor) { return frameProcessor; }
export default { useLocationPermission, withLocation };
