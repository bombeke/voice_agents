// Web stand-in: the GPU frame resizer is native-only.
export function useResizer() {
  return {
    state: "error",
    resizer: undefined,
    error: new Error("Not available on web."),
  };
}
export function createResizer() {
  return Promise.reject(new Error("Not available on web."));
}
