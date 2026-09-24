import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChoiceRow } from "../ChoiceRow";

const LABELS = { metric: "Metric", imperial: "Imperial" };

describe("ChoiceRow", () => {
  it("opens the options and picks one", async () => {
    const onChange = jest.fn();
    await render(
      <ChoiceRow
        label="Units"
        options={["metric", "imperial"] as const}
        labels={LABELS}
        value="metric"
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole("button", { name: "Units: Metric" }),
    );
    expect(screen.getByRole("radio", { name: "Metric" })).toBeChecked();

    await fireEvent.press(screen.getByRole("radio", { name: "Imperial" }));
    expect(onChange).toHaveBeenCalledWith("imperial");
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
  });
});
