import { fireEvent, render, screen } from "@testing-library/react-native";
import { OptionSheet } from "../OptionSheet";

const LABELS = { 1: "1 photo", 2: "Up to 2", 3: "Up to 3" };

describe("OptionSheet", () => {
  it("checks the current option and picks another", async () => {
    const onPick = jest.fn();
    await render(
      <OptionSheet
        title="Photos per asset"
        options={[1, 2, 3] as const}
        value={3}
        labels={LABELS}
        onPick={onPick}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("header", { name: "Photos per asset" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Up to 3" })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "1 photo" }));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("stays closed without options", async () => {
    await render(
      <OptionSheet
        title="Units"
        options={null}
        value="metric"
        labels={{ metric: "Metric" }}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
  });
});
