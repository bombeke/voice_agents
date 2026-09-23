import { fireEvent, render, screen } from "@testing-library/react-native";
import { DuplicateNotice } from "../DuplicateNotice";

const DUPLICATE = {
  id: "EP-00412",
  category: "energy" as const,
  label: "pole",
  latitude: 0,
  longitude: 0,
  capturedAt: new Date(2026, 7, 12).getTime(),
  distanceM: 3.24,
};

describe("DuplicateNotice", () => {
  it("describes the nearby asset and asks update or new", async () => {
    const onChoose = jest.fn();
    await render(
      <DuplicateNotice
        duplicate={DUPLICATE}
        choice={null}
        onChoose={onChoose}
      />,
    );
    expect(screen.getByText(/Possible duplicate\./)).toBeTruthy();
    expect(
      screen.getByText(/A pole \(EP-00412\) was recorded 3\.2 m away on .*Aug/),
    ).toBeTruthy();
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();

    await fireEvent.press(
      screen.getByRole("radio", { name: "Update the existing asset" }),
    );
    expect(onChoose).toHaveBeenCalledWith("update");
  });

  it("checks the chosen answer", async () => {
    await render(
      <DuplicateNotice
        duplicate={{ ...DUPLICATE, label: null }}
        choice="new"
        onChoose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "This is a new asset", checked: true }),
    ).toBeTruthy();
    expect(screen.getByText(/A asset \(EP-00412\)/)).toBeTruthy();
  });
});
