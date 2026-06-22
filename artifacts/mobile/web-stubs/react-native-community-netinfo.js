export function useNetInfo() {
  return { isConnected: true, isInternetReachable: true, type: 'wifi' };
}
export function addEventListener(listener) {
  return { remove: () => {} };
}
export async function fetch() {
  return { isConnected: true, isInternetReachable: true, type: 'wifi' };
}
export default { useNetInfo, addEventListener, fetch };
