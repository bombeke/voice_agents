import {
  categoryForLabel,
  CONFIDENCE,
  DETECTOR_MODEL,
  DETECTOR_MODEL_VERSION,
  labelsHiddenFor,
} from "../DetectorModel";

describe("DETECTOR_MODEL", () => {
  it("defaults to the registry YOLO26 nano 384 with the §6.3 floor", () => {
    expect(DETECTOR_MODEL.modelPath).toBe(
      "https://example.test/yolo26n_384_xnnpack_fp32.pte",
    );
    expect(DETECTOR_MODEL.modelOpts.defaultConfidenceThreshold).toBe(
      CONFIDENCE.hidden,
    );
    expect(DETECTOR_MODEL_VERSION).toBe("yolo26n_384_xnnpack_fp32.pte");
  });

  it("takes the model URL and labels from the build environment", () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_DETECTOR_MODEL_URL =
        "https://models.test/iip_v3.pte?sig=x";
      process.env.EXPO_PUBLIC_DETECTOR_LABELS =
        "concrete_pole, borehole ,culvert";
      try {
        const m = require("../DetectorModel");
        expect(m.DETECTOR_MODEL.modelPath).toBe(
          "https://models.test/iip_v3.pte?sig=x",
        );
        expect(m.DETECTOR_MODEL.modelOpts.labels).toEqual([
          "concrete_pole",
          "borehole",
          "culvert",
        ]);
        expect(m.DETECTOR_MODEL_VERSION).toBe("iip_v3.pte");
      } finally {
        delete process.env.EXPO_PUBLIC_DETECTOR_MODEL_URL;
        delete process.env.EXPO_PUBLIC_DETECTOR_LABELS;
      }
    });
  });
});

describe("categoryForLabel", () => {
  it("places custom and COCO labels by keyword", () => {
    expect(categoryForLabel("concrete_pole")).toBe("energy");
    expect(categoryForLabel("Borehole")).toBe("water");
    expect(categoryForLabel("fire hydrant")).toBe("water");
    expect(categoryForLabel("telecom-mast")).toBe("telecom");
    expect(categoryForLabel("traffic light")).toBe("roads");
    expect(categoryForLabel("person")).toBeNull();
  });
});

describe("labelsHiddenFor", () => {
  const labels = ["pole", "borehole", "culvert", "person"];

  it("hides only labels that belong to another category", () => {
    expect(labelsHiddenFor("energy", labels)).toEqual({
      borehole: true,
      culvert: true,
    });
  });

  it("hides nothing when the AI picks the category", () => {
    expect(labelsHiddenFor("auto", labels)).toEqual({});
  });
});
