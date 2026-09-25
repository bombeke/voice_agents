import type { ReviewDetection } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReplaceBaseSheet } from "../ReplaceBaseSheet";

const detection: ReviewDetection = {
  trackId: 1,
  label: "pole",
  confidence: 0.91,
  box: { xmin: 0.4, ymin: 0.1, xmax: 0.6, ymax: 0.9 },
  imageUri: "/tmp/1.jpg",
  decision: "accepted",
  attributes: [],
};

async function renderLoaded(onPlace: jest.Mock, onClose = jest.fn()) {
  await render(
    <ReplaceBaseSheet
      detection={detection}
      photoSize={{ width: 1080, height: 2160 }}
      onPlace={onPlace}
      onClose={onClose}
    />,
  );
  const photo = screen.getByRole("button", {
    name: "Photo of Pole. Tap its base",
  });
  await fireEvent(photo, "layout", {
    nativeEvent: { layout: { width: 400, height: 800 } },
  });
  return { photo, onClose };
}

describe("ReplaceBaseSheet", () => {
  it("hands over the tapped point as fractions of the photo and closes", async () => {
    const onPlace = jest.fn(() => true);
    const { photo, onClose } = await renderLoaded(onPlace);
    expect(screen.getByText("Tap the base of pole")).toBeTruthy();
    await fireEvent.press(photo, {
      nativeEvent: { locationX: 200, locationY: 600 },
    });
    expect(onPlace).toHaveBeenCalledWith({ x: 0.5, y: 0.75 });
    expect(onClose).toHaveBeenCalled();
  });

  it("asks again when the point misses the ground", async () => {
    const onPlace = jest.fn(() => false);
    const { photo, onClose } = await renderLoaded(onPlace);
    await fireEvent.press(photo, {
      nativeEvent: { locationX: 200, locationY: 100 },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That point isn’t on the ground the phone measured. Tap lower, at the base.",
    );
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
