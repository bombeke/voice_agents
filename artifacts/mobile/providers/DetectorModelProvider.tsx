import {
  DETECTOR_MODEL,
  DETECTOR_MODEL_VERSION,
} from "@/constants/DetectorModel";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { download } from "react-native-executorch";

export type DetectorModelStatus = "downloading" | "ready" | "failed";

export interface DetectorModelState {
  status: DetectorModelStatus;
  /** 0–100. */
  progress: number;
  version: string;
  retry: () => void;
}

const DetectorModelContext = createContext<DetectorModelState | null>(null);

/**
 * Downloads the detector into executorch's persistent cache at launch, without
 * holding the splash screen, so the capture screen loads it from disk. Cache
 * hits resolve at once; a failed download (offline first run) is retried on
 * request, and capture still works without AI (design-doc §4.3).
 */
export function DetectorModelProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<DetectorModelStatus>("downloading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus("downloading");
    download(DETECTOR_MODEL, {
      signal: controller.signal,
      onProgress: (p) => {
        if (active) setProgress(Math.round(p * 100));
      },
    })
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!active) return;
        console.warn("Detector model download failed:", e);
        setStatus("failed");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <DetectorModelContext.Provider
      value={{ status, progress, version: DETECTOR_MODEL_VERSION, retry }}
    >
      {children}
    </DetectorModelContext.Provider>
  );
}

export function useDetectorModel(): DetectorModelState {
  const value = useContext(DetectorModelContext);
  if (!value) {
    throw new Error(
      "useDetectorModel must be used inside DetectorModelProvider",
    );
  }
  return value;
}
