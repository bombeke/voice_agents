import { fireEvent, render, screen } from "@testing-library/react-native";
import { StatusChips } from "../StatusChips";

describe("StatusChips", () => {
  it("checks the selected statuses and toggles on tap", async () => {
    const onToggle = jest.fn();
    await render(
      <StatusChips
        options={["good", "inclined", "vegetation"]}
        selected={["inclined"]}
        onToggle={onToggle}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Inclined", checked: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Good condition", checked: false }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Covered by vegetation" }),
    );
    expect(onToggle).toHaveBeenCalledWith("vegetation");
  });
});
