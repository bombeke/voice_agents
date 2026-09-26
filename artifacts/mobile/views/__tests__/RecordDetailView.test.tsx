import { fakeMapAssets } from "@/mocks/assets";
import { fakeCaptures } from "@/mocks/captures";
import { fakeRecords, fakeRecordFor } from "@/mocks/records";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { addTeamRecords } from "@/services/storage/ReviewStore";
import {
  fireEvent,
  render as rntlRender,
  screen,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import { RecordDetailView } from "../RecordDetailView";

const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const NOW = new Date(2026, 8, 22, 10, 14);
const CAPTURES = fakeCaptures(NOW);

const getDb = setupTestDatabase();

beforeEach(async () => {
  jest.clearAllMocks();
  const records = fakeRecords(CAPTURES, fakeMapAssets(NOW));
  const byId = Object.fromEntries(records.map((r) => [r.id, r]));
  await seedCaptures(getDb(), CAPTURES, { records: byId });
  const previous = byId["fake-record-ep-00412-previous"];
  await seedCaptures(
    getDb(),
    [
      {
        ...CAPTURES[0],
        id: previous.id,
        capturedAt: previous.capturedAt,
        syncStatus: "synced",
      },
    ],
    { records: { [previous.id]: previous } },
  );
});

/** Renders once the record has been read (the loading state is blank). */
async function render(ui: ReactElement) {
  const r = await rntlRender(ui);
  await screen.findByRole("button", { name: /Back|Back to records/ });
  return r;
}

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

  it("opens a downloaded team record read-only, naming who captured it", async () => {
    const capturedBy = { id: "enumerator-04", name: "Enumerator 04" };
    const summary = {
      ...CAPTURES[4],
      id: "team-record-3",
      title: "Transformer",
      capturedBy,
    };
    const { assetId: _assetId, ...noAsset } = summary;
    await addTeamRecords([
      {
        summary: noAsset,
        record: {
          ...fakeRecordFor(noAsset, fakeMapAssets(NOW), 2),
          capturedBy,
        },
      },
    ]);
    await render(<RecordDetailView id="team-record-3" />);
    expect(
      screen.getByRole("header", { name: "Transformer" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Captured by Enumerator 04")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Edit record" })).toBeNull();
  });

  it("names nobody on the user's own record, and lets them edit it", async () => {
    await render(<RecordDetailView id="fake-capture-1" />);
    expect(screen.queryByText(/^Captured by /)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Edit record" }),
    ).toBeOnTheScreen();
  });
});
