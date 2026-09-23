import type { CapturedPhoto } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CaptureTray, statusLine } from "../CaptureTray";

const photo = (i: number, sharp: boolean | null = true): CapturedPhoto => ({
  imageUri: `/tmp/${i}.jpg`,
  capturedAt: i,
  heading: null,
  detections: [],
  quality: { sharp, exposureOk: sharp === null ? null : true },
});

const props = {
  photos: [] as CapturedPhoto[],
  canCapture: true,
  isCapturing: false,
  offerDraft: false,
  onCapture: jest.fn(),
  onRetake: jest.fn(),
  onContinue: jest.fn(),
  onSaveDraft: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("statusLine", () => {
  it("names the next photo and the last photo's checks", () => {
    expect(statusLine([])).toBe("Photo 1 of 3");
    expect(statusLine([photo(1)])).toBe("Photo 2 of 3 · sharp · exposure OK");
    expect(statusLine([photo(1), photo(2), photo(3, false)])).toBe(
      "Photo 3 of 3 · blurry · exposure OK",
    );
    expect(statusLine([photo(1, null)])).toBe("Photo 2 of 3");
  });
});

describe("CaptureTray", () => {
  it("takes a photo when the gate is open", async () => {
    await render(<CaptureTray {...props} />);
    expect(screen.getByText("Location is stamped when you tap")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    expect(props.onCapture).toHaveBeenCalled();
  });

  it("locks the shutter until GPS is under 4 m", async () => {
    await render(<CaptureTray {...props} canCapture={false} />);
    const shutter = screen.getByRole("button", {
      name: "Take photo — locked until GPS accuracy is under 4 metres",
    });
    expect(shutter).toBeDisabled();
    expect(screen.getByText("Capture unlocks below 4 m")).toBeTruthy();
  });

  it("offers a draft after waiting without a lock", async () => {
    await render(<CaptureTray {...props} canCapture={false} offerDraft />);
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Can’t get below 4 m? Save as draft for review",
      }),
    );
    expect(props.onSaveDraft).toHaveBeenCalled();
  });

  it("shows taken photos for retake and continues to the form", async () => {
    await render(<CaptureTray {...props} photos={[photo(1), photo(2)]} />);
    expect(screen.getByLabelText("Photos taken: 2 of 3")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Photo 2. Tap to retake" }),
    );
    expect(props.onRetake).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(props.onContinue).toHaveBeenCalled();
  });

  it("disables the shutter once three photos are taken", async () => {
    await render(
      <CaptureTray {...props} photos={[photo(1), photo(2), photo(3)]} />,
    );
    expect(screen.getByRole("button", { name: "Take photo" })).toBeDisabled();
  });
});
