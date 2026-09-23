import { speechToText, type Dictation } from "@/services/capture/SpeechToText";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice-to-text for the tagging form's comment (design-doc §3 step 8). The
 * microphone is asked for on the first tap; `available` is false where the
 * device has no recogniser, so the mic button can be hidden. `onText` gets
 * each final transcript and should be stable (a store action).
 */
export function useDictation(onText: (text: string) => void) {
  const [available] = useState(() => speechToText().isAvailable());
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set from the tap until recognition ends, including the permission prompt.
  const active = useRef(false);
  const session = useRef<Dictation | null>(null);

  const stop = useCallback(() => {
    active.current = false;
    session.current?.stop();
  }, []);

  const start = useCallback(async () => {
    active.current = true;
    setFailed(false);
    setListening(true);
    const ended = () => {
      active.current = false;
      session.current = null;
      setListening(false);
    };
    try {
      const dictation = await speechToText().start({
        onText,
        onError: () => setFailed(true),
        onEnd: ended,
      });
      if (!dictation) return ended(); // Microphone refused.
      session.current = dictation;
      // Stopped while the permission prompt was up.
      if (!active.current) dictation.stop();
    } catch {
      ended();
      setFailed(true);
    }
  }, [onText]);

  const toggle = useCallback(() => {
    if (active.current) stop();
    else void start();
  }, [start, stop]);

  // Leaving the screen ends the recognition.
  useEffect(() => stop, [stop]);

  return { available, listening, failed, toggle };
}
