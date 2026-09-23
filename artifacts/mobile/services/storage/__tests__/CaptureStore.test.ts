import type { CaptureSummary } from "@/types/Capture";
import {
  addCapture,
  captures$,
  clearCaptures,
  replaceCaptures,
} from "../CaptureStore";

const capture = (id: string, title = "Borehole"): CaptureSummary => ({
  id,
  category: "water",
  title,
  capturedAt: "2026-09-23T10:14:03+03:00",
  accuracyM: 3.1,
  syncStatus: "pending",
  flagged: false,
});

beforeEach(() => clearCaptures());

describe("CaptureStore", () => {
  it("adds captures and replaces one saved again under the same id", () => {
    addCapture(capture("a"));
    addCapture(capture("b"));
    addCapture(capture("a", "Borehole · repaired"));
    expect(captures$.get().map((c) => [c.id, c.title])).toEqual([
      ["b", "Borehole"],
      ["a", "Borehole · repaired"],
    ]);
  });

  it("replaces and clears the whole list", () => {
    replaceCaptures([capture("x"), capture("y")]);
    expect(captures$.get()).toHaveLength(2);
    clearCaptures();
    expect(captures$.get()).toEqual([]);
  });
});
