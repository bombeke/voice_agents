import { fakeMapAssets } from "@/mocks/assets";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SelectedAssetCard } from "../SelectedAssetCard";

const pole = {
  ...fakeMapAssets().find((a) => a.id === "EP-00412")!,
  // Seen "today" even when the suite runs just after midnight.
  lastSeenAt: Date.now(),
};

function renderCard(
  over: Partial<Parameters<typeof SelectedAssetCard>[0]> = {},
) {
  const props = {
    asset: pole,
    position: null,
    profileOpen: false,
    onToggleProfile: jest.fn(),
    onRecapture: jest.fn(),
    onViewRecord: jest.fn(),
    onClose: jest.fn(),
    ...over,
  };
  return { props, view: render(<SelectedAssetCard {...props} />) };
}

describe("SelectedAssetCard", () => {
  it("shows the asset, when it was seen and its condition", async () => {
    await renderCard().view;
    expect(
      screen.getByRole("header", { name: "Concrete pole" }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/^EP-00412 · last seen today \d\d:\d\d$/),
    ).toBeOnTheScreen();
    expect(screen.getByText("Inclined 7°")).toBeOnTheScreen();
    expect(screen.getByText("Vegetation: partial")).toBeOnTheScreen();
    expect(screen.getByLabelText("Energy & Power")).toBeOnTheScreen();
  });

  it("adds the distance once the device position is known", async () => {
    await renderCard({
      position: {
        latitude: pole.latitude + 38 / 111_320,
        longitude: pole.longitude,
      },
    }).view;
    expect(screen.getByText(/· 38 m away$/)).toBeOnTheScreen();
  });

  it("wires the actions", async () => {
    const { props, view } = renderCard();
    await view;
    await fireEvent.press(screen.getByRole("button", { name: "Re-capture" }));
    expect(props.onRecapture).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "View record" }));
    expect(props.onViewRecord).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Close asset" }));
    expect(props.onClose).toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show asset profile" }),
    );
    expect(props.onToggleProfile).toHaveBeenCalled();
    expect(screen.queryByText("Attributes")).toBeNull();
  });

  it("opens into the asset profile", async () => {
    await renderCard({ profileOpen: true }).view;
    expect(
      screen.getByRole("button", {
        name: "Hide asset profile",
        expanded: true,
      }),
    ).toBeOnTheScreen();

    // Attributes with their source and confidence.
    expect(
      screen.getByRole("header", { name: "Attributes" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Material")).toBeOnTheScreen();
    expect(screen.getByText("Concrete")).toBeOnTheScreen();
    expect(screen.getByText("7° from vertical")).toBeOnTheScreen();
    expect(screen.getByText("Distance from main road")).toBeOnTheScreen();
    expect(screen.getByText("GIS")).toBeOnTheScreen();

    // Location and record history.
    expect(
      screen.getByText(
        `${pole.latitude.toFixed(6)}, ${pole.longitude.toFixed(6)}`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`±${pole.accuracyM.toFixed(1)} m`),
    ).toBeOnTheScreen();
    expect(screen.getByText(pole.capturedBy)).toBeOnTheScreen();
    expect(screen.getByLabelText("Status: Pending")).toBeOnTheScreen();
    expect(screen.getByText(pole.comment)).toBeOnTheScreen();
  });

  it("flags records routed to a supervisor", async () => {
    const light = fakeMapAssets().find((a) => a.id === "EP-00415")!;
    await renderCard({ asset: light, profileOpen: true }).view;
    expect(
      screen.getByLabelText("Status: Flagged for supervisor review"),
    ).toBeOnTheScreen();
    expect(screen.getByText("No")).toBeOnTheScreen();
  });
});
