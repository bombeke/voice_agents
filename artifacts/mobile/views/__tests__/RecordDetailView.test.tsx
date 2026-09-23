import { fakeMapAssets } from "@/mocks/assets";
import { fakeCaptures } from "@/mocks/captures";
import { fakeRecords } from "@/mocks/records";
import { replaceCaptures } from "@/services/storage/CaptureStore";
import { replaceRecords } from "@/services/storage/RecordStore";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecordDetailView } from "../RecordDetailView";

// mocks/captures reads the network flag; the real module opens sync timers.
jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));

const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const NOW = new Date(2026, 8, 22, 10, 14);
const CAPTURES = fakeCaptures(NOW);

beforeEach(() => {
  jest.clearAllMocks();
  replaceCaptures(CAPTURES);
  replaceRecords(fakeRecords(CAPTURES, fakeMapAssets(NOW)));
});

describe("RecordDetailView", () => {
  it("shows the mockup's pole", async () => {
    await render(<RecordDetailView id="fake-capture-1" />);
    expect(screen.getByText("1 of 2 photos")).toBeOnTheScreen();
    expect(screen.getByText("Energy & Power")).toBeOnTheScreen();
    expect(screen.getByText("Waiting to sync")).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: "Concrete pole" }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^EP-00412 · captured /)).toBeOnTheScreen();
    expect(screen.getByText("7° from vertical")).toBeOnTheScreen();
    expect(
      screen.getByText("Inclined, covered by vegetation"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Leaning toward the road after heavy rain."),
    ).toBeOnTheScreen();
    expect(screen.getByText("1,203.4 m")).toBeOnTheScreen();
    expect(screen.getByText("±2.8 m")).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/· this capture, Inclined 7°, partial vegetation$/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/, Inclined 4°, no vegetation$/),
    ).toBeOnTheScreen();
  });

  it("opens by asset code, as the Map links", async () => {
    await render(<RecordDetailView id="EP-00412" />);
    expect(
      screen.getByText("Leaning toward the road after heavy rain."),
    ).toBeOnTheScreen();
  });

  it("shows the asset on the map and opens the record for editing", async () => {
    await render(<RecordDetailView id="fake-capture-1" />);
    await fireEvent.press(screen.getByRole("button", { name: "Show on map" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/map",
      params: { id: "EP-00412" },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Edit record" }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/capture/tag",
      params: { recordId: "fake-capture-1" },
    });
  });

  it("has no map link without an asset code", async () => {
    const toilet = CAPTURES.find((c) => c.title === "Toilet block")!;
    await render(<RecordDetailView id={toilet.id} />);
    expect(screen.getByText(/^Captured /)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Show on map" })).toBeNull();
  });

  it("goes back, or to Records when opened directly", async () => {
    await render(<RecordDetailView id="fake-capture-1" />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to records" }),
    );
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValueOnce(false);
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to records" }),
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)/records");
  });

  it("says when the record isn't on the device", async () => {
    await render(<RecordDetailView id="nope" />);
    expect(
      screen.getByText("This record isn’t on this device."),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to records" }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
