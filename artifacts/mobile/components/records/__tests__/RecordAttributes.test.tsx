import type { CaptureRecord } from "@/types/Capture";
import { render, screen } from "@testing-library/react-native";
import { RecordAttributes } from "../RecordAttributes";

const RECORD = {
  attributes: [
    { key: "material", value: "concrete", source: "ai", confidence: "high" },
    { key: "estimatedAge", value: "10-20", source: "user", confidence: null },
    { key: "distanceFromRoad", value: null, source: "gis", confidence: null },
  ],
  statuses: ["inclined", "vegetation"],
  suggestedStatuses: ["inclined"],
} as unknown as CaptureRecord;

describe("RecordAttributes", () => {
  it("shows each value with its source, the statuses before GIS", async () => {
    await render(<RecordAttributes record={RECORD} />);
    expect(
      screen.getByRole("header", { name: "Attributes" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Source")).toBeOnTheScreen();
    expect(screen.getByText("Concrete")).toBeOnTheScreen();
    expect(screen.getByText("AI · high")).toBeOnTheScreen();
    expect(screen.getByText("10–20 years")).toBeOnTheScreen();
    expect(
      screen.getByText("Inclined, covered by vegetation"),
    ).toBeOnTheScreen();
    // The surveyor's age and statuses.
    expect(screen.getAllByText("User")).toHaveLength(2);
    expect(screen.getByText("Calculated after sync")).toBeOnTheScreen();
    expect(screen.getByText("GIS")).toBeOnTheScreen();
    // Read-only here: nothing to tap.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks statuses kept from the AI, and says when there are none", async () => {
    await render(
      <RecordAttributes
        record={{ ...RECORD, attributes: [], statuses: ["inclined"] }}
      />,
    );
    expect(screen.getByText("AI")).toBeOnTheScreen();
    await render(
      <RecordAttributes record={{ ...RECORD, attributes: [], statuses: [] }} />,
    );
    expect(screen.getByText("Not recorded")).toBeOnTheScreen();
  });
});
