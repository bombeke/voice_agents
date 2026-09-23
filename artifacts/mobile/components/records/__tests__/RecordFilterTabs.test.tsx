import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecordFilterTabs } from "../RecordFilterTabs";

const COUNTS = { all: 14, pending: 3, flagged: 1, uploading: 0, failed: 0 };

describe("RecordFilterTabs", () => {
  it("labels each tab with its count and switches tabs", async () => {
    const onChange = jest.fn();
    await render(
      <RecordFilterTabs value="all" onChange={onChange} counts={COUNTS} />,
    );
    expect(
      screen.getByRole("tab", { name: "All · 14", selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("tab", { name: "Flagged · 1", selected: false }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Pending · 3" }));
    expect(onChange).toHaveBeenCalledWith("pending");
  });
});
