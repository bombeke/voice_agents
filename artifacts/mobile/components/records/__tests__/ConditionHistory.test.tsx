import { render, screen } from "@testing-library/react-native";
import { ConditionHistory } from "../ConditionHistory";

describe("ConditionHistory", () => {
  it("lists each capture with its condition", async () => {
    await render(
      <ConditionHistory
        entries={[
          {
            id: "a",
            title: "22 Sep 2026 · this capture",
            summary: "Inclined 7°, partial vegetation",
            current: true,
          },
          {
            id: "b",
            title: "12 Aug 2026",
            summary: "Inclined 4°, no vegetation",
            current: false,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("header", { name: "Condition history" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        "22 Sep 2026 · this capture, Inclined 7°, partial vegetation",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText("12 Aug 2026, Inclined 4°, no vegetation"),
    ).toBeOnTheScreen();
  });
});
