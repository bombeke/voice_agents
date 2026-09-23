import { fakeDetectionEstimator } from "@/mocks/detections";
import { setDetectionEstimator } from "@/services/capture/AttributeEstimator";
import { clearCaptures } from "@/services/storage/CaptureStore";
import {
  addPhoto,
  beginReview,
  captureSession$,
  startSession,
} from "@/services/storage/CaptureSessionStore";
import type { CapturedPhoto } from "@/types/Capture";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { DetectionReviewView } from "../DetectionReviewView";

const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const mockAddPole = jest.fn(async () => undefined);
jest.mock("@/providers/UtilityStoreProvider", () => ({
  useUtilityStorePoles: () => ({ addPole: mockAddPole, poles: [] }),
}));
jest.mock("@/hooks/Helpers", () => ({
  requestSavePermission: async () => true,
}));
jest.mock("expo-media-library", () => ({ createAssetAsync: jest.fn() }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const photo = (imageUri: string): CapturedPhoto => ({
  imageUri,
  capturedAt: Date.parse("2026-09-23T09:20:00Z"),
  heading: 142,
  detections: [],
  quality: { sharp: true, exposureOk: true },
});

const LOCATION = {
  latitude: 0.3476,
  longitude: 32.5825,
  accuracy: 2.8,
  altitude: 1190,
  satellites: 18,
  flags: [],
};

/** The mockup's session: a pole (0.91), a distant pole (0.64), a street light (0.83). */
function seed(photos = 1) {
  startSession("energy");
  for (let i = 1; i <= photos; i++) addPhoto(photo(`/tmp/${i}.jpg`), LOCATION);
  beginReview();
}

beforeEach(() => {
  jest.clearAllMocks();
  clearCaptures();
  setDetectionEstimator(fakeDetectionEstimator);
});
afterEach(() => setDetectionEstimator());

describe("DetectionReviewView", () => {
  it("summarises the detections as step 2 of 3", async () => {
    seed();
    await render(<DetectionReviewView />);
    expect(
      screen.getByRole("header", { name: "Review detections" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Energy & Power · 3 found · model yolo26n_384_xnnpack_fp32.pte",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();

    // Only the first card starts open.
    expect(
      screen.getByRole("button", { name: "Hide 1 Pole attributes" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Show 3 Street light attributes" }),
    ).toBeTruthy();
    expect(screen.getByText("Please check")).toBeTruthy();
    expect(
      screen.getByText("Suggested · confidence 0.64 · wood?"),
    ).toBeTruthy();
  });

  it("accepts a suggestion", async () => {
    seed();
    await render(<DetectionReviewView />);
    await fireEvent.press(screen.getByRole("button", { name: "Accept" }));
    expect(
      screen.queryByText("Suggested · confidence 0.64 · wood?"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show 2 Pole attributes" }),
    ).toBeTruthy();
  });

  it("rejects a suggestion and can undo it", async () => {
    seed();
    await render(<DetectionReviewView />);
    await fireEvent.press(screen.getByRole("button", { name: "Not an asset" }));
    expect(screen.getByText("Not an asset · confidence 0.64")).toBeTruthy();
    expect(
      screen.getByRole("image", { name: "Photo with 2 detections" }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });

  it("corrects an attribute, which then shows as the user's", async () => {
    seed();
    await render(<DetectionReviewView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Change material" }),
    );
    expect(
      screen.getByRole("radio", { name: "Concrete", checked: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Wood" }));

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Wood")).toBeTruthy();
    expect(screen.getByText("User")).toBeTruthy();
  });

  it("goes back to the camera to add a photo", async () => {
    seed();
    await render(<DetectionReviewView />);
    await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("disables adding a photo once there are three", async () => {
    seed(3);
    await render(<DetectionReviewView />);
    expect(screen.getByRole("button", { name: "Add photo" })).toBeDisabled();
  });

  it("opens the tagging form from the reviewed detections", async () => {
    seed();
    await render(<DetectionReviewView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue to tagging" }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith("/capture/tag");
    // The pole's lean and vegetation are pre-selected.
    expect(captureSession$.tagging.peek()).toMatchObject({
      category: "energy",
      statuses: ["inclined", "vegetation"],
      functional: "unknown",
    });
    expect(mockAddPole).not.toHaveBeenCalled();
  });

  it("explains when nothing was detected", async () => {
    setDetectionEstimator();
    seed();
    await render(<DetectionReviewView />);
    expect(
      screen.getByText(
        "No assets were detected. Continue to tag the photo, or add another.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue to tagging" }),
    ).toBeEnabled();
  });
});
