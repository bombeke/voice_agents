import {
  setStatusSuggester,
  suggestStatuses,
} from "@/services/capture/StatusSuggester";
import type { DetectionAttribute, ReviewDetection } from "@/types/Capture";

const detection = (
  attributes: Partial<Record<DetectionAttribute["key"], string | null>>,
  decision: ReviewDetection["decision"] = "accepted",
): ReviewDetection => ({
  trackId: 1,
  label: "pole",
  confidence: 0.9,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
  imageUri: "/tmp/1.jpg",
  decision,
  attributes: Object.entries(attributes).map(([key, value]) => ({
    key: key as DetectionAttribute["key"],
    value: value ?? null,
    source: "ai",
    confidence: "high",
  })),
});

afterEach(() => setStatusSuggester());

describe("suggestStatuses", () => {
  it("suggests a lean past 5° and vegetation cover", () => {
    expect(
      suggestStatuses({
        category: "energy",
        detections: [
          detection({ inclination: "7", vegetationCover: "partial" }),
        ],
      }),
    ).toEqual(["inclined", "vegetation"]);
  });

  it("suggests nothing for upright, clear or unestimated assets", () => {
    expect(
      suggestStatuses({
        category: "energy",
        detections: [
          detection({ inclination: "4", vegetationCover: "none" }),
          detection({ inclination: null }),
        ],
      }),
    ).toEqual([]);
  });

  it("ignores detections that weren't kept", () => {
    expect(
      suggestStatuses({
        category: "energy",
        detections: [detection({ inclination: "12" }, "rejected")],
      }),
    ).toEqual([]);
  });

  it("keeps a swapped-in suggester to the category's statuses", () => {
    setStatusSuggester(() => ["sagging_lines", "leaking"]);
    expect(suggestStatuses({ category: "water", detections: [] })).toEqual([
      "leaking",
    ]);
  });
});
