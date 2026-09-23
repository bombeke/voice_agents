import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { MapLayersSheet } from "../MapLayersSheet";

const PREFS = { basemap: "streets", cluster: true } as const;

// The clustering Toggle animates its knob.
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe("MapLayersSheet", () => {
  it("picks a basemap and turns clustering off", async () => {
    const onChange = jest.fn();
    await render(
      <MapLayersSheet
        visible
        preferences={PREFS}
        onChange={onChange}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("header", { name: "Map layers" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("radio", { name: "Streets", checked: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "Satellite" }));
    expect(onChange).toHaveBeenCalledWith({ basemap: "satellite" });

    await fireEvent.press(
      screen.getByRole("switch", { name: "Group nearby pins" }),
    );
    expect(onChange).toHaveBeenCalledWith({ cluster: false });
  });

  it("closes from the Done button", async () => {
    const onClose = jest.fn();
    await render(
      <MapLayersSheet
        visible
        preferences={PREFS}
        onChange={jest.fn()}
        onClose={onClose}
      />,
    );
    const [, done] = screen.getAllByRole("button", { name: "Done" });
    await fireEvent.press(done);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while hidden", async () => {
    await render(
      <MapLayersSheet
        visible={false}
        preferences={PREFS}
        onChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByRole("header", { name: "Map layers" })).toBeNull();
  });
});
