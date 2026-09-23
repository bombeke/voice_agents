import type { DetectionAttribute } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AttributeRow } from "../AttributeRow";

const attr = (over: Partial<DetectionAttribute>): DetectionAttribute => ({
  key: "material",
  value: "concrete",
  source: "ai",
  confidence: "high",
  ...over,
});

describe("AttributeRow", () => {
  it("shows the value with its source and confidence, and edits on tap", async () => {
    const onEdit = jest.fn();
    await render(<AttributeRow attribute={attr({})} onEdit={onEdit} />);
    expect(screen.getByText("Material")).toBeTruthy();
    expect(screen.getByText("Concrete")).toBeTruthy();
    expect(screen.getByText("AI · high")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Change material" }),
    );
    expect(onEdit).toHaveBeenCalled();
  });

  it("asks the surveyor to check low-confidence values", async () => {
    await render(
      <AttributeRow
        attribute={attr({
          key: "estimatedAge",
          value: "10-20",
          confidence: "low",
        })}
      />,
    );
    expect(screen.getByText("10–20 years")).toBeTruthy();
    expect(screen.getByText("Please check")).toBeTruthy();
    expect(screen.getByText("AI · low")).toBeTruthy();
  });

  it("marks corrected values as the user's", async () => {
    await render(
      <AttributeRow attribute={attr({ source: "user", confidence: null })} />,
    );
    expect(screen.getByText("User")).toBeTruthy();
    expect(screen.queryByText("Please check")).toBeNull();
  });

  it("leaves pending and GIS values read-only", async () => {
    const onEdit = jest.fn();
    await render(
      <>
        <AttributeRow
          attribute={attr({
            key: "estimatedAge",
            value: null,
            confidence: null,
          })}
          onEdit={onEdit}
        />
        <AttributeRow
          attribute={attr({
            key: "distanceFromRoad",
            value: null,
            source: "gis",
            confidence: null,
          })}
          onEdit={onEdit}
        />
      </>,
    );
    expect(screen.getByText("Estimated after sync")).toBeTruthy();
    expect(screen.getByText("Calculated after sync")).toBeTruthy();
    expect(screen.getByText("GIS")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
