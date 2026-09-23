import { fireEvent, render, screen } from "@testing-library/react-native";
import { SegmentedControl } from "../SegmentedControl";

const LABELS = { yes: "Yes", no: "No", unknown: "Unknown" };

describe("SegmentedControl", () => {
  it("checks the current option and picks another", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        label="Functional?"
        options={["yes", "no", "unknown"] as const}
        labels={LABELS}
        value="unknown"
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "Unknown", checked: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Yes" }));
    expect(onChange).toHaveBeenCalledWith("yes");
  });

  it("disables every option", async () => {
    await render(
      <SegmentedControl
        label="Functional?"
        options={["yes", "no"] as const}
        labels={LABELS}
        value="yes"
        onChange={jest.fn()}
        disabled
      />,
    );
    expect(screen.getByRole("radio", { name: "No" })).toBeDisabled();
  });

  it("acts as tabs when it switches the content below", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        role="tablist"
        label="Filter records"
        options={["yes", "no"] as const}
        labels={LABELS}
        value="yes"
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("tab", { name: "Yes", selected: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "No" }));
    expect(onChange).toHaveBeenCalledWith("no");
  });
});
