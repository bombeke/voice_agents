import {
  acceptedDetections,
  attributeKeysFor,
  confidenceBand,
  formatAttributeValue,
  formatLabel,
  initialDecision,
  isEditable,
  mostDetectedPhoto,
  photoRect,
  reviewCategory,
  shouldFlag,
  suggestionHint,
  viewToPhotoFraction,
} from "@/helpers/detectionReview";
import type {
  CaptureLocation,
  DetectionAttribute,
  ReviewDetection,
} from "@/types/Capture";

const attr = (over: Partial<DetectionAttribute>): DetectionAttribute => ({
  key: "material",
  value: "concrete",
  source: "ai",
  confidence: "high",
  ...over,
});

const detection = (over: Partial<ReviewDetection> = {}): ReviewDetection => ({
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
  imageUri: "/tmp/1.jpg",
  decision: "accepted",
  attributes: [
    attr({ key: "material" }),
    attr({ key: "inclination", value: "7", confidence: "medium" }),
    attr({
      key: "distanceFromRoad",
      value: null,
      source: "gis",
      confidence: null,
    }),
  ],
  ...over,
});

const LOCATION: CaptureLocation = {
  latitude: 0,
  longitude: 0,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

describe("initialDecision and confidenceBand", () => {
  it("pre-accepts from 0.70 and suggests below", () => {
    expect(initialDecision(0.7)).toBe("accepted");
    expect(initialDecision(0.699)).toBe("suggested");
    expect(initialDecision(0.4)).toBe("suggested");
  });

  it("bands scores as high, medium and low", () => {
    expect(confidenceBand(0.91)).toBe("high");
    expect(confidenceBand(0.7)).toBe("high");
    expect(confidenceBand(0.4)).toBe("medium");
    expect(confidenceBand(0.39)).toBe("low");
  });
});

describe("attributes", () => {
  it("lists the attributes for each category", () => {
    expect(attributeKeysFor("energy")).toEqual([
      "material",
      "inclination",
      "estimatedHeight",
      "estimatedAge",
      "vegetationCover",
      "distanceFromRoad",
    ]);
    expect(attributeKeysFor(null)).toEqual([
      "estimatedAge",
      "countInFrame",
      "distanceFromRoad",
    ]);
  });

  it("formats option codes and templated values", () => {
    expect(formatAttributeValue("estimatedAge", "10-20")).toBe("10–20 years");
    expect(formatAttributeValue("inclination", "7")).toBe("7° from vertical");
    expect(formatAttributeValue("estimatedHeight", "9.2")).toBe("9.2 m");
    expect(formatAttributeValue("countInFrame", "1")).toBe("1");
    expect(formatAttributeValue("material", null)).toBeNull();
  });

  it("only lets estimated, device-editable values be changed", () => {
    expect(isEditable(attr({}))).toBe(true);
    expect(isEditable(attr({ value: null }))).toBe(false);
    expect(
      isEditable(attr({ key: "distanceFromRoad", value: "40", source: "gis" })),
    ).toBe(false);
  });
});

describe("labels", () => {
  it("turns detector labels into titles", () => {
    expect(formatLabel("street_light")).toBe("Street light");
    expect(formatLabel("pole")).toBe("Pole");
  });

  it("hints the material on a suggestion", () => {
    expect(suggestionHint(detection())).toBe("concrete?");
    expect(suggestionHint(detection({ attributes: [] }))).toBeNull();
  });
});

describe("reviewCategory", () => {
  it("keeps the camera's category", () => {
    expect(reviewCategory("water", [detection()])).toBe("water");
  });

  it("takes the first kept detection's category when the AI picks", () => {
    expect(
      reviewCategory("auto", [
        detection({ label: "culvert", decision: "rejected" }),
        detection({ label: "person" }),
        detection({ label: "pole" }),
      ]),
    ).toBe("energy");
    expect(reviewCategory("auto", [])).toBeNull();
  });
});

describe("acceptedDetections and shouldFlag", () => {
  it("keeps only accepted detections", () => {
    const kept = acceptedDetections([
      detection({ trackId: 1 }),
      detection({ trackId: 2, decision: "suggested" }),
      detection({ trackId: 3, decision: "rejected" }),
    ]);
    expect(kept.map((d) => d.trackId)).toEqual([1]);
  });

  it("does not flag a confident, unedited capture with a verified fix", () => {
    expect(shouldFlag([detection()], LOCATION)).toBe(false);
  });

  it("flags an unverified location", () => {
    expect(shouldFlag([], { ...LOCATION, flags: ["gps_unverified"] })).toBe(
      true,
    );
  });

  it("flags an accepted suggestion (low AI confidence)", () => {
    expect(shouldFlag([detection({ confidence: 0.64 })], LOCATION)).toBe(true);
  });

  it("flags heavy edits but ignores rejected detections", () => {
    const edited = detection({
      attributes: [
        attr({ key: "material", source: "user", confidence: null }),
        attr({ key: "inclination", value: "7" }),
      ],
    });
    expect(shouldFlag([edited], LOCATION)).toBe(true);
    expect(shouldFlag([{ ...edited, decision: "rejected" }], LOCATION)).toBe(
      false,
    );
  });
});

describe("photoRect", () => {
  it("places a box on a letterboxed photo", () => {
    // A 4:3 landscape photo in a 300×300 view is 300×225, 37.5 px from the top.
    expect(
      photoRect(
        { xmin: 0.5, ymin: 0, xmax: 1, ymax: 1 },
        { width: 4000, height: 3000 },
        { width: 300, height: 300 },
      ),
    ).toEqual({ left: 150, top: 37.5, width: 150, height: 225 });
  });

  it("is empty until the photo size is known", () => {
    expect(
      photoRect(
        { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
        { width: 0, height: 0 },
        { width: 300, height: 300 },
      ),
    ).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe("mostDetectedPhoto", () => {
  it("picks the photo with the most detections, the first on a tie", () => {
    expect(
      mostDetectedPhoto([
        detection({ imageUri: "/tmp/1.jpg" }),
        detection({ imageUri: "/tmp/2.jpg" }),
        detection({ imageUri: "/tmp/2.jpg" }),
      ]),
    ).toBe("/tmp/2.jpg");
    expect(
      mostDetectedPhoto([
        detection({ imageUri: "/tmp/1.jpg" }),
        detection({ imageUri: "/tmp/2.jpg" }),
      ]),
    ).toBe("/tmp/1.jpg");
    expect(mostDetectedPhoto([])).toBeNull();
  });
});

describe("viewToPhotoFraction", () => {
  it("undoes the letterbox of a contained photo", () => {
    // A 1000 × 2000 photo in a 400 × 400 view is 200 wide, centred.
    const photo = { width: 1000, height: 2000 };
    const view = { width: 400, height: 400 };
    expect(viewToPhotoFraction({ x: 200, y: 300 }, photo, view)).toEqual({
      x: 0.5,
      y: 0.75,
    });
    expect(viewToPhotoFraction({ x: 50, y: 300 }, photo, view)).toBeNull();
    expect(
      viewToPhotoFraction({ x: 1, y: 1 }, { width: 0, height: 0 }, view),
    ).toBeNull();
  });
});
