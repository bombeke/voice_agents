import { act, renderHook } from "@testing-library/react-native";
import { useObjectDetector } from "react-native-executorch";
import { useLiveDetection } from "../useLiveDetection";

// Reanimated's Jest mock makes a new shared value every render; the real one is stable.
jest.mock("react-native-reanimated", () => {
  const { useState } = jest.requireActual("react");
  return {
    ...jest.requireActual("react-native-reanimated/mock"),
    useSharedValue: (init: unknown) => useState(() => ({ value: init }))[0],
  };
});

type OnFrame = (frame: unknown) => void;
let mockOnFrame: OnFrame | undefined;
jest.mock("react-native-vision-camera", () => ({
  useFrameOutput: (opts: { onFrame: OnFrame }) => {
    mockOnFrame = opts.onFrame;
    return { kind: "frame-output" };
  },
}));

const mockResized = {
  getPixelBuffer: () => new ArrayBuffer(384 * 384 * 3),
  dispose: jest.fn(),
};
jest.mock("react-native-vision-camera-resizer", () => ({
  useResizer: () => ({ resizer: { resize: () => mockResized } }),
}));

const detect = jest.fn();
const mockUseObjectDetector = jest.mocked(useObjectDetector);

const frame = (orientation = "up") => ({
  width: 1080,
  height: 1920,
  orientation,
  dispose: jest.fn(),
});

const pole = (x: number, confidence = 0.9) => ({
  label: "pole",
  confidence,
  box: { xmin: x, ymin: 40, xmax: x + 40, ymax: 300 },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseObjectDetector.mockReturnValue({
    isReady: true,
    error: undefined,
    downloadProgress: 100,
    detectObjectsWorklet: detect,
  } as never);
});

describe("useLiveDetection", () => {
  it("tracks detections across frames and publishes confirmed tracks", async () => {
    const { result } = await renderHook(() => useLiveDetection("energy", true));
    detect.mockReturnValue([pole(100)]);
    await act(async () => mockOnFrame!(frame()));
    // Seen once: not shown yet.
    expect(result.current.trackLabels).toEqual([]);

    detect.mockReturnValue([pole(104)]);
    await act(async () => mockOnFrame!(frame()));
    expect(result.current.trackLabels).toEqual([
      {
        trackId: expect.any(Number),
        label: "pole",
        confidence: 0.9,
        suggested: false,
      },
    ]);
    expect(result.current.inferenceMs).toEqual(expect.any(Number));
    expect(result.current.frameSize).toEqual({ width: 1080, height: 1920 });
    expect(result.current.status).toBe("ready");
  });

  it("marks 0.40–0.70 detections as suggested", async () => {
    const { result } = await renderHook(() => useLiveDetection("energy", true));
    detect.mockReturnValue([pole(100, 0.55)]);
    await act(async () => mockOnFrame!(frame()));
    await act(async () => mockOnFrame!(frame()));
    expect(result.current.trackLabels[0].suggested).toBe(true);
  });

  it("drops labels that belong to another category", async () => {
    const { result } = await renderHook(() => useLiveDetection("water", true));
    detect.mockReturnValue([pole(100)]);
    await act(async () => mockOnFrame!(frame()));
    await act(async () => mockOnFrame!(frame()));
    expect(result.current.trackLabels).toEqual([]);
  });

  it("snapshots tracks as fractions of the frame", async () => {
    const { result } = await renderHook(() => useLiveDetection("energy", true));
    detect.mockReturnValue([pole(100)]);
    await act(async () => mockOnFrame!(frame()));
    await act(async () => mockOnFrame!(frame()));
    const [snap] = result.current.snapshot();
    expect(snap.label).toBe("pole");
    for (const v of Object.values(snap.box)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("disposes frames even when detection throws", async () => {
    await renderHook(() => useLiveDetection("energy", true));
    detect.mockImplementation(() => {
      throw new Error("model busy");
    });
    const f = frame();
    await act(async () => mockOnFrame!(f));
    expect(f.dispose).toHaveBeenCalled();
    expect(mockResized.dispose).toHaveBeenCalled();
  });

  it("skips inference while inactive", async () => {
    await renderHook(() => useLiveDetection("energy", false));
    const f = frame();
    await act(async () => mockOnFrame!(f));
    expect(detect).not.toHaveBeenCalled();
    expect(f.dispose).toHaveBeenCalled();
  });

  it("reports an unavailable model", async () => {
    mockUseObjectDetector.mockReturnValue({
      isReady: false,
      error: new Error("download failed"),
      downloadProgress: 0,
      detectObjectsWorklet: undefined,
    } as never);
    const { result } = await renderHook(() => useLiveDetection("auto", true));
    expect(result.current.status).toBe("unavailable");
  });
});
