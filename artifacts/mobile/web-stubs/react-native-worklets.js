export function runOnJS(fn) { return fn; }
export function runOnUI(fn) { return fn; }
export function scheduleOnRN(fn, ...args) {
  if (typeof fn === 'function') fn(...args);
}
export const Worklets = {
  createRunOnJS: (fn) => fn,
  createRunOnUI: (fn) => fn,
};
export default { runOnJS, runOnUI, scheduleOnRN, Worklets };
