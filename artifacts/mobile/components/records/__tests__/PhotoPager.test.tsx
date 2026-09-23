import { fireEvent, render, screen } from "@testing-library/react-native";
import { PhotoPager } from "../PhotoPager";

jest.mock("@/services/storage/ImageStore", () => ({
  toFileUri: (uri?: string) => uri && `file://${uri}`,
}));

const page = (x: number) => ({
  nativeEvent: {
    contentOffset: { x, y: 0 },
    layoutMeasurement: { width: 390, height: 280 },
  },
});

describe("PhotoPager", () => {
  it("counts the photos and follows the swipe", async () => {
    await render(
      <PhotoPager
        photos={[{ uri: "/a.jpg" }, { uri: "/b.jpg" }]}
        category="energy"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText("1 of 2 photos")).toBeOnTheScreen();
    expect(screen.getByLabelText("Photo 2 of 2")).toBeOnTheScreen();
    await fireEvent(
      screen.getByLabelText("Photos"),
      "momentumScrollEnd",
      page(390),
    );
    expect(screen.getByText("2 of 2 photos")).toBeOnTheScreen();
  });

  it("shows a placeholder for a photo that isn't on the device", async () => {
    await render(
      <PhotoPager
        photos={[{ uri: null }]}
        category="water"
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText("1 photo")).toBeOnTheScreen();
    expect(screen.getByText("No photo on this device")).toBeOnTheScreen();
  });

  it("falls back to the placeholder when a photo fails to load", async () => {
    await render(
      <PhotoPager
        photos={[{ uri: "/gone.jpg" }]}
        category="roads"
        onBack={jest.fn()}
      />,
    );
    await fireEvent(screen.getByLabelText("Photo 1 of 1"), "error");
    expect(screen.getByText("No photo on this device")).toBeOnTheScreen();
  });

  it("goes back", async () => {
    const onBack = jest.fn();
    await render(<PhotoPager photos={[]} category="energy" onBack={onBack} />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to records" }),
    );
    expect(onBack).toHaveBeenCalled();
  });
});
