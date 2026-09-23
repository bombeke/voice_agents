import { fireEvent, render, screen } from "@testing-library/react-native";
import { MapControls } from "../MapControls";

describe("MapControls", () => {
  it("opens layers and centres on the device", async () => {
    const onLayersPress = jest.fn();
    const onLocatePress = jest.fn();
    await render(
      <MapControls
        onLayersPress={onLayersPress}
        onLocatePress={onLocatePress}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Map layers" }));
    expect(onLayersPress).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole("button", { name: "Center on my location" }),
    );
    expect(onLocatePress).toHaveBeenCalledTimes(1);
  });
});
