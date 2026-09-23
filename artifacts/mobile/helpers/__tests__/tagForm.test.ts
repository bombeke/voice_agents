import {
  appendText,
  formatShortDate,
  mergeSuggestions,
  primaryDetection,
  statusesFor,
  tagFormProblem,
  tagSubtitle,
  toggleStatus,
} from "@/helpers/tagForm";
import type { ReviewDetection, TagForm } from "@/types/Capture";

const detection = (over: Partial<ReviewDetection> = {}): ReviewDetection => ({
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
  imageUri: "/tmp/1.jpg",
  decision: "accepted",
  attributes: [
    { key: "material", value: "concrete", source: "ai", confidence: "high" },
  ],
  ...over,
});

const form = (over: Partial<TagForm> = {}): TagForm => ({
  category: "energy",
  statuses: ["inclined"],
  suggested: [],
  functional: "unknown",
  comment: "",
  duplicate: null,
  duplicateChoice: null,
  ...over,
});

describe("statusesFor", () => {
  it("lists the category's statuses, good first, and none without one", () => {
    expect(statusesFor("energy")).toEqual([
      "good",
      "inclined",
      "vegetation",
      "cracked",
      "rust",
      "sagging_lines",
      "under_construction",
    ]);
    expect(statusesFor(null)).toEqual([]);
  });
});

describe("toggleStatus", () => {
  it("adds and removes statuses", () => {
    expect(toggleStatus(["inclined"], "rust")).toEqual(["inclined", "rust"]);
    expect(toggleStatus(["inclined", "rust"], "inclined")).toEqual(["rust"]);
  });

  it("keeps good condition and faults apart", () => {
    expect(toggleStatus(["inclined", "rust"], "good")).toEqual(["good"]);
    expect(toggleStatus(["good"], "rust")).toEqual(["rust"]);
  });
});

describe("mergeSuggestions", () => {
  it("follows new suggestions but keeps the surveyor's picks and removals", () => {
    // The AI suggested inclined and vegetation; the surveyor removed
    // vegetation and added rust.
    const previous = form({
      suggested: ["inclined", "vegetation"],
      statuses: ["inclined", "rust"],
    });
    expect(
      mergeSuggestions(previous, ["vegetation", "cracked"], "energy"),
    ).toEqual(["cracked", "rust"]);
  });

  it("lets the surveyor's good condition win over AI faults", () => {
    expect(
      mergeSuggestions(
        { suggested: [], statuses: ["good"] },
        ["inclined"],
        "energy",
      ),
    ).toEqual(["good"]);
  });

  it("drops statuses the new category doesn't have", () => {
    expect(
      mergeSuggestions(
        { suggested: [], statuses: ["sagging_lines", "rust"] },
        [],
        "water",
      ),
    ).toEqual(["rust"]);
  });
});

describe("tagSubtitle and primaryDetection", () => {
  it("names the first kept asset, its material and the count", () => {
    const detections = [
      detection({ decision: "rejected", trackId: 9, label: "street_light" }),
      detection(),
      detection({ trackId: 2, attributes: [] }),
    ];
    expect(primaryDetection(detections)?.trackId).toBe(1);
    expect(tagSubtitle(detections)).toBe("Pole · concrete · 2 detections kept");
  });

  it("counts one or none", () => {
    expect(tagSubtitle([detection({ attributes: [] })])).toBe(
      "Pole · 1 detection kept",
    );
    expect(tagSubtitle([detection({ decision: "suggested" })])).toBe(
      "No detections kept",
    );
    expect(primaryDetection([])).toBeNull();
  });
});

describe("tagFormProblem", () => {
  it("needs a category, a status and a duplicate answer for a record", () => {
    expect(tagFormProblem(null, false)).toBe("category");
    expect(tagFormProblem(form({ category: null }), false)).toBe("category");
    expect(tagFormProblem(form({ statuses: [] }), false)).toBe("status");
    const duplicate = {
      id: "EP-00412",
      category: "energy" as const,
      label: "pole",
      latitude: 0,
      longitude: 0,
      capturedAt: 0,
      distanceM: 3.2,
    };
    expect(tagFormProblem(form({ duplicate }), false)).toBe("duplicate");
    expect(
      tagFormProblem(form({ duplicate, duplicateChoice: "new" }), false),
    ).toBeNull();
  });

  it("needs only a category for a draft", () => {
    expect(tagFormProblem(form({ statuses: [] }), true)).toBeNull();
    expect(tagFormProblem(form({ category: null }), true)).toBe("category");
  });
});

describe("appendText", () => {
  it("adds dictation after typed text with one space", () => {
    expect(appendText("", " Leaning. ")).toBe("Leaning.");
    expect(appendText("Pole A. ", "Leaning.")).toBe("Pole A. Leaning.");
    expect(appendText("Pole A.", "  ")).toBe("Pole A.");
  });
});

describe("formatShortDate", () => {
  it("formats day and short month", () => {
    expect(formatShortDate(new Date(2026, 7, 12).getTime(), "en-GB")).toBe(
      "12 Aug",
    );
  });
});
