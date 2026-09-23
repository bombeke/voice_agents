import { speechToText } from "@/services/capture/SpeechToText";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

const speech = jest.mocked(ExpoSpeechRecognitionModule);

type Listener = (event: unknown) => void;
let listeners: Record<string, Listener>;

beforeEach(() => {
  jest.clearAllMocks();
  listeners = {};
  speech.addListener.mockImplementation(((name: string, fn: Listener) => {
    listeners[name] = fn;
    return { remove: jest.fn() };
  }) as never);
});

const handlers = () => ({
  onText: jest.fn(),
  onError: jest.fn(),
  onEnd: jest.fn(),
});

describe("speechToText (device)", () => {
  it("reports whether the device can recognise speech", () => {
    speech.isRecognitionAvailable.mockReturnValueOnce(true);
    expect(speechToText().isAvailable()).toBe(true);
    speech.isRecognitionAvailable.mockImplementationOnce(() => {
      throw new Error("no module");
    });
    expect(speechToText().isAvailable()).toBe(false);
  });

  it("does nothing when the microphone is refused", async () => {
    speech.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
    } as never);
    expect(await speechToText().start(handlers())).toBeNull();
    expect(speech.start).not.toHaveBeenCalled();
  });

  it("passes final transcripts on and cleans up at the end", async () => {
    speech.requestPermissionsAsync.mockResolvedValueOnce({
      granted: true,
    } as never);
    const h = handlers();
    const dictation = await speechToText().start(h);
    expect(speech.start).toHaveBeenCalledWith(
      expect.objectContaining({ interimResults: false, continuous: false }),
    );

    listeners.result({ isFinal: false, results: [{ transcript: "Lean" }] });
    listeners.result({
      isFinal: true,
      results: [{ transcript: "Leaning after rain." }],
    });
    expect(h.onText).toHaveBeenCalledTimes(1);
    expect(h.onText).toHaveBeenCalledWith("Leaning after rain.");

    listeners.error({ error: "network" });
    expect(h.onError).toHaveBeenCalledWith("network");

    dictation?.stop();
    expect(speech.stop).toHaveBeenCalled();
    listeners.end(null);
    expect(h.onEnd).toHaveBeenCalled();
  });
});
