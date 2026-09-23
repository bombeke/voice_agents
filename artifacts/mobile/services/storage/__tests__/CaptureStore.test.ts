import type { CaptureSummary } from "@/types/Capture";
import {
  addCapture,
  captures$,
  clearCaptures,
  replaceCaptures,
  setCaptureStatus,
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
  it("adds captures and replaces one saved again under the same id in place", () => {
    addCapture(capture("a"));
    addCapture(capture("b"));
    addCapture(capture("a", "Borehole · repaired"));
    expect(captures$.get().map((c) => [c.id, c.title])).toEqual([
      ["a", "Borehole · repaired"],
      ["b", "Borehole"],
    ]);
  });

  it("moves only the given records to a new sync state", () => {
    replaceCaptures([capture("a"), capture("b"), capture("c")]);
    setCaptureStatus(["a", "c", "missing"], "uploading");
    expect(captures$.get().map((c) => c.syncStatus)).toEqual([
      "uploading",
      "pending",
      "uploading",
    ]);
  });

  it("replaces and clears the whole list", () => {
    replaceCaptures([capture("x"), capture("y")]);
    expect(captures$.get()).toHaveLength(2);
    clearCaptures();
    expect(captures$.get()).toEqual([]);
  });
});
