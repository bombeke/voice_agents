import { useRef } from 'react';

export function runOnJS(fn) { return fn; }
export function runOnUI(fn) { return fn; }
export function createWorklet(fn) { return fn; }

export function useSharedValue(init) {
  const ref = useRef({ value: init });
  return ref.current;
}

export const Worklets = {
  createRunOnJS: (fn) => fn,
  createRunOnUI: (fn) => fn,
};

export const WorkletsCore = {};
export default WorkletsCore;
