import { distanceM } from "@/helpers/duplicateCheck";
import {
  FAKE_DICTATION,
  FAKE_DUPLICATE_ID,
  fakeNearbyAssetSource,
  fakeSpeechToText,
} from "../tagging";

const AT = { latitude: 0.3476, longitude: 32.5825 };

describe("fakeNearbyAssetSource", () => {
  it("adds the mockup's pole 3.2 m away, recorded on the last 12 August", () => {
    const [known, fake] = fakeNearbyAssetSource(
      AT,
      [
        {
          id: "EP-1",
          category: "water",
          label: null,
          latitude: 0,
          longitude: 0,
          capturedAt: 0,
        },
      ],
      new Date(2026, 6, 1),
    );
    expect(known.id).toBe("EP-1");
    expect(fake).toMatchObject({
      id: FAKE_DUPLICATE_ID,
      category: "energy",
      label: "pole",
    });
    expect(distanceM(AT, fake)).toBeCloseTo(3.2, 1);
    expect(new Date(fake.capturedAt).getFullYear()).toBe(2025);
    expect(new Date(fake.capturedAt).getMonth()).toBe(7);
  });
});

describe("fakeSpeechToText", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("hears the mockup's comment, then ends", async () => {
    const onText = jest.fn();
    const onEnd = jest.fn();
    expect(fakeSpeechToText.isAvailable()).toBe(true);
    await fakeSpeechToText.start({ onText, onEnd, onError: jest.fn() });
    jest.runAllTimers();
    expect(onText).toHaveBeenCalledWith(FAKE_DICTATION);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("ends without text when stopped early", async () => {
    const onText = jest.fn();
    const onEnd = jest.fn();
    const dictation = await fakeSpeechToText.start({
      onText,
      onEnd,
      onError: jest.fn(),
    });
    dictation?.stop();
    jest.runAllTimers();
    expect(onText).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
