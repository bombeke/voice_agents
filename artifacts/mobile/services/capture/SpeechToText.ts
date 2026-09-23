import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export interface DictationHandlers {
  /** A final transcript; called once per recognised utterance. */
  onText: (text: string) => void;
  onError: (error: string) => void;
  /** Recognition stopped, after a result, an error or `stop()`. */
  onEnd: () => void;
}

export interface Dictation {
  stop: () => void;
}

export interface SpeechToText {
  isAvailable: () => boolean;
  /** Asks for the microphone first; resolves null when it is refused. */
  start: (handlers: DictationHandlers) => Promise<Dictation | null>;
}

/** On-device recognition through expo-speech-recognition (Web Speech on web). */
const device: SpeechToText = {
  isAvailable() {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  },

  async start({ onText, onError, onEnd }) {
    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return null;
    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener("result", (event) => {
        if (event.isFinal) onText(event.results[0]?.transcript ?? "");
      }),
      ExpoSpeechRecognitionModule.addListener("error", (event) =>
        onError(event.error),
      ),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        subscriptions.forEach((s) => s.remove());
        onEnd();
      }),
    ];
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      continuous: false,
      addsPunctuation: true,
    });
    return { stop: () => ExpoSpeechRecognitionModule.stop() };
  },
};

let current: SpeechToText = device;

export function speechToText(): SpeechToText {
  return current;
}

/** Dev mocks or tests swap the recogniser; pass nothing to restore. */
export function setSpeechToText(recogniser: SpeechToText = device) {
  current = recogniser;
}
