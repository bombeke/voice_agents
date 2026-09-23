import type { NormalizedBox } from "@/types/Capture";
import type { Box } from "./detectionTracker";

/**
 * Geometry between the three spaces a live detection passes through, after
 * software-mansion-labs/react-native-executorch-gallery
 * (src/components/RealtimeDetectionViewport.tsx):
 *
 *   camera frame ──resizer "cover"──▶ model input (e.g. 384²) ──▶ preview view ("cover")
 */

export interface Size {
  width: number;
  height: number;
}

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Maps model-input pixels onto a preview shown with resizeMode="cover".
 * Both the resizer and the preview crop the frame to cover, so the model
 * input's centre is the preview's centre and one scale applies:
 * viewScale / resizerScale. Without a frame size it falls back to covering the
 * viewport with the input directly.
 */
export function computeViewportTransform(
  viewport: Size,
  input: Size,
  frame?: Size | null,
): ViewportTransform {
  "worklet";
  const { width: vw, height: vh } = viewport;
  if (vw <= 0 || vh <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };

  let scale: number;
  if (frame && frame.width > 0 && frame.height > 0) {
    const resizerScale = Math.max(
      input.width / frame.width,
      input.height / frame.height,
    );
    const viewScale = Math.max(vw / frame.width, vh / frame.height);
    scale = viewScale / resizerScale;
  } else {
    scale = Math.max(vw / input.width, vh / input.height);
  }
  return {
    scale,
    offsetX: (vw - input.width * scale) / 2,
    offsetY: (vh - input.height * scale) / 2,
  };
}

/** A model-input box on screen, clamped to the viewport. */
export function toScreenRect(
  box: Box,
  t: ViewportTransform,
  viewport: Size,
): ScreenRect {
  "worklet";
  const clampX = (x: number) => Math.max(0, Math.min(viewport.width, x));
  const clampY = (y: number) => Math.max(0, Math.min(viewport.height, y));
  const left = clampX(t.offsetX + box.xmin * t.scale);
  const top = clampY(t.offsetY + box.ymin * t.scale);
  const right = clampX(t.offsetX + box.xmax * t.scale);
  const bottom = clampY(t.offsetY + box.ymax * t.scale);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * On Android the resizer's shader hands over sideways frames rotated 180°, so
 * boxes come back mirrored on both axes. The gallery applies this to every
 * non-square frame; here it is limited to Android sideways frames, which is
 * where the resizer does it. Verify on both platforms when changing devices.
 */
export function unrotateAndroidBox(
  box: Box,
  input: Size,
  isAndroid: boolean,
  isSideways: boolean,
): Box {
  "worklet";
  if (!isAndroid || !isSideways) return box;
  return {
    xmin: input.width - box.xmax,
    xmax: input.width - box.xmin,
    ymin: input.height - box.ymax,
    ymax: input.height - box.ymin,
  };
}

/**
 * Model-input box → fractions of the upright camera frame, for storing on the
 * photo (whose resolution differs from both the preview and the model input).
 * Undoes the resizer's centred "cover" crop.
 */
export function toFrameFraction(
  box: Box,
  input: Size,
  frame: Size,
): NormalizedBox {
  const scale = Math.max(
    input.width / frame.width,
    input.height / frame.height,
  );
  const cropX = (frame.width * scale - input.width) / 2;
  const cropY = (frame.height * scale - input.height) / 2;
  const fx = (x: number) =>
    Math.max(0, Math.min(1, (x + cropX) / scale / frame.width));
  const fy = (y: number) =>
    Math.max(0, Math.min(1, (y + cropY) / scale / frame.height));
  return {
    xmin: fx(box.xmin),
    ymin: fy(box.ymin),
    xmax: fx(box.xmax),
    ymax: fy(box.ymax),
  };
}
