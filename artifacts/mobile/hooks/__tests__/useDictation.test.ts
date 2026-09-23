import {
  setSpeechToText,
  type DictationHandlers,
  type SpeechToText,
} from "@/services/capture/SpeechToText";
import { act, renderHook } from "@testing-library/react-native";
import { useDictation } from "../useDictation";

let handlers: DictationHandlers | null;
const stop = jest.fn(() => handlers?.onEnd());

function recogniser(over: Partial<SpeechToText> = {}): SpeechToText {
  return {
    isAvailable: () => true,
    start: jest.fn(async (h: DictationHandlers) => {
      handlers = h;
      return { stop };
    }),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  handlers = null;
});
afterEach(() => setSpeechToText());

describe("useDictation", () => {
  it("is unavailable without a recogniser", async () => {
    const { result } = await renderHook(() => useDictation(jest.fn()));
    expect(result.current.available).toBe(false);
  });

  it("listens on toggle and hands over final text", async () => {
    setSpeechToText(recogniser());
    const onText = jest.fn();
    const { result } = await renderHook(() => useDictation(onText));
    expect(result.current.available).toBe(true);

    await act(async () => result.current.toggle());
    expect(result.current.listening).toBe(true);

    await act(async () => handlers?.onText("Leaning."));
    expect(onText).toHaveBeenCalledWith("Leaning.");

    await act(async () => handlers?.onEnd());
    expect(result.current.listening).toBe(false);
  });

  it("stops on a second toggle and when unmounted", async () => {
    setSpeechToText(recogniser());
    const { result, unmount } = await renderHook(() => useDictation(jest.fn()));
    await act(async () => result.current.toggle());
    await act(async () => result.current.toggle());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(false);

    await act(async () => result.current.toggle());
    await act(async () => unmount());
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("stops listening when the microphone is refused", async () => {
    setSpeechToText(recogniser({ start: async () => null }));
    const { result } = await renderHook(() => useDictation(jest.fn()));
    await act(async () => result.current.toggle());
    expect(result.current.listening).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("reports a failed recognition", async () => {
    setSpeechToText(recogniser());
    const { result } = await renderHook(() => useDictation(jest.fn()));
    await act(async () => result.current.toggle());
    await act(async () => {
      handlers?.onError("network");
      handlers?.onEnd();
    });
    expect(result.current.failed).toBe(true);
    expect(result.current.listening).toBe(false);
  });
});
