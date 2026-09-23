/**
 * SORT-style tracker for live detections. It runs inside the frame processor,
 * so every function is a worklet and all state lives in a per-mount
 * TrackerState object (never module-level) that only the worklet mutates.
 *
 * Boxes are in model-input pixels, `xyxy`.
 */

export interface Box {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface Detection {
  box: Box;
  label: string;
  confidence: number;
}

export interface Track extends Detection {
  trackId: number;
  /** Per-inference velocity of the top-left corner, in pixels. */
  vx: number;
  vy: number;
  /** Inferences since this track last matched a detection. */
  age: number;
  /** Detections matched so far. */
  hits: number;
}

export interface TrackerState {
  tracks: Track[];
  nextId: number;
}

/** A detection must overlap a predicted track by more than this to continue it. */
export const MATCH_IOU = 0.3;
/** A new track is shown only after this many matches, which stops one-frame flicker. */
export const MIN_HITS = 2;
/** A lost track keeps moving on its prediction for this many inferences, then goes. */
export const MAX_COAST = 5;
/** Velocity smoothing: weight of the newest displacement. */
const ALPHA = 0.7;

export function createTrackerState(): TrackerState {
  "worklet";
  return { tracks: [], nextId: 1 };
}

export function iou(a: Box, b: Box): number {
  "worklet";
  const xA = Math.max(a.xmin, b.xmin);
  const yA = Math.max(a.ymin, b.ymin);
  const xB = Math.min(a.xmax, b.xmax);
  const yB = Math.min(a.ymax, b.ymax);
  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const areaA = (a.xmax - a.xmin) * (a.ymax - a.ymin);
  const areaB = (b.xmax - b.xmin) * (b.ymax - b.ymin);
  return inter / (areaA + areaB - inter + 1e-6);
}

/** Constant-velocity step forward. */
export function predict(track: Track): Track {
  "worklet";
  return {
    ...track,
    box: {
      xmin: track.box.xmin + track.vx,
      ymin: track.box.ymin + track.vy,
      xmax: track.box.xmax + track.vx,
      ymax: track.box.ymax + track.vy,
    },
    age: track.age + 1,
  };
}

/**
 * Matches this inference's detections to the predicted tracks (greedy, best
 * IoU, same label, one detection per track), starts tracks for the rest and
 * coasts unmatched tracks for up to MAX_COAST inferences. Mutates and returns
 * `state.tracks`.
 */
export function updateTracks(
  state: TrackerState,
  detections: readonly Detection[],
): Track[] {
  "worklet";
  const predicted = state.tracks.map(predict);
  const used: Record<number, true> = {};
  const next: Track[] = [];

  for (const det of detections) {
    let best: Track | null = null;
    let bestScore = MATCH_IOU;
    for (const track of predicted) {
      if (track.label !== det.label || used[track.trackId]) continue;
      const score = iou(track.box, det.box);
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    }

    if (best) {
      used[best.trackId] = true;
      // Displacement from where the track was before this prediction step.
      const dx = det.box.xmin - (best.box.xmin - best.vx);
      const dy = det.box.ymin - (best.box.ymin - best.vy);
      next.push({
        trackId: best.trackId,
        box: det.box,
        label: det.label,
        confidence: det.confidence,
        vx: ALPHA * dx + (1 - ALPHA) * best.vx,
        vy: ALPHA * dy + (1 - ALPHA) * best.vy,
        age: 0,
        hits: best.hits + 1,
      });
    } else {
      next.push({
        trackId: state.nextId++,
        box: det.box,
        label: det.label,
        confidence: det.confidence,
        vx: 0,
        vy: 0,
        age: 0,
        hits: 1,
      });
    }
  }

  for (const track of predicted) {
    if (!used[track.trackId] && track.age <= MAX_COAST) next.push(track);
  }

  state.tracks = next;
  return next;
}

/** Tracks confirmed often enough to draw. */
export function visibleTracks(tracks: readonly Track[]): Track[] {
  "worklet";
  return tracks.filter((t) => t.hits >= MIN_HITS);
}
