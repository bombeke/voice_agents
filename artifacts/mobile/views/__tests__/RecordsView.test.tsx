import { replaceCaptures } from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/LegendState";
import { setCaptureUploader } from "@/services/sync/CaptureSync";
import type { CaptureSummary } from "@/types/Capture";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RecordsView } from "../RecordsView";

jest.mock("@/services/storage/LegendState", () => {
  const { observable } = require("@legendapp/state");
  return {
    isOnline$: observable(true),
    opQueue$: observable([]),
    failedOps$: observable([]),
    replayOpQueue: jest.fn(),
    retryFailedOps: jest.fn(),
  };
});

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();
const today = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const record = (over: Partial<CaptureSummary>): CaptureSummary => ({
  id: "r",
  category: "energy",
  title: "Concrete pole",
  capturedAt: today(0, 30),
  accuracyM: 2.8,
  syncStatus: "synced",
  flagged: false,
  ...over,
});

const RECORDS = [
  record({
    id: "pole",
    detail: "2 detections",
    capturedAt: today(0, 40),
    syncStatus: "pending",
    assetId: "EP-00412",
  }),
  record({
    id: "borehole",
    category: "water",
    title: "Borehole · hand pump",
    capturedAt: today(0, 20),
    syncStatus: "pending",
  }),
  record({
    id: "culvert",
    category: "roads",
    title: "Culvert · pipe",
    capturedAt: today(0, 10),
    flagged: true,
  }),
  record({
    id: "mast",
    category: "telecom",
    title: "Telecom mast · lattice",
    capturedAt: hoursAgo(30),
  }),
];

const mockRouter = { push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const row = (title: string) =>
  screen.getByLabelText(new RegExp(`^${title.replace(/[·]/g, ".")}, `));

beforeEach(() => {
  setCaptureUploader(async () => ({ synced: [], failed: [] }));
  isOnline$.set(true);
  replaceCaptures(RECORDS);
});

describe("RecordsView", () => {
  it("groups records by day under the sync banner and tabs", async () => {
    await render(<RecordsView />);
    expect(screen.getByRole("header", { name: "Records" })).toBeOnTheScreen();
    expect(screen.getByText("2 records waiting to upload")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "All · 4" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Today" })).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: /Yesterday|\w{3} \d+ \w+/ }),
    ).toBeOnTheScreen();
    expect(row("Concrete pole")).toHaveAccessibleName(
      /· ±2\.8 m · 2 detections, Pending$/,
    );
    expect(row("Culvert · pipe")).toHaveAccessibleName(/Flagged$/);
    expect(row("Telecom mast · lattice")).toHaveAccessibleName(/Synced$/);
  });

  it("narrows the list with the tabs and shows an empty tab", async () => {
    await render(<RecordsView />);
    await fireEvent.press(screen.getByRole("tab", { name: "Pending · 2" }));
    expect(row("Borehole · hand pump")).toBeOnTheScreen();
    expect(screen.queryByText("Culvert · pipe")).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Flagged · 1" }));
    expect(screen.getByText("Culvert · pipe")).toBeOnTheScreen();

    replaceCaptures(RECORDS.map((r) => ({ ...r, flagged: false })));
    await act(async () => {});
    expect(screen.getByText("No flagged records.")).toBeOnTheScreen();
  });

  it("searches records and clears the search on close", async () => {
    await render(<RecordsView />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Search records" }),
    );
    const field = screen.getByLabelText("Search by name, ID or category");
    await fireEvent.changeText(field, "ep-00412");
    expect(screen.getByText("Concrete pole")).toBeOnTheScreen();
    expect(screen.queryByText("Culvert · pipe")).toBeNull();
    await fireEvent.changeText(field, "tower");
    expect(screen.getByText("No records match your search.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Close search" }));
    expect(screen.getByText("Culvert · pipe")).toBeOnTheScreen();
  });

  it("uploads with Sync now and hides the banner once all is synced", async () => {
    setCaptureUploader(async (due) => ({
      synced: due.map((c) => c.id),
      failed: [],
    }));
    await render(<RecordsView />);
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(row("Concrete pole")).toHaveAccessibleName(/Synced$/);
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Pending · 0" })).toBeOnTheScreen();
  });

  it("keeps records pending and says so while offline", async () => {
    isOnline$.set(false);
    await render(<RecordsView />);
    expect(
      screen.getByText("No network · photos upload on Wi-Fi"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(row("Concrete pole")).toHaveAccessibleName(/Pending$/);
  });

  it("opens on the tab from the route", async () => {
    await render(<RecordsView filter="flagged" />);
    expect(
      screen.getByRole("tab", { name: "Flagged · 1", selected: true }),
    ).toBeOnTheScreen();
  });

  it("opens a record's detail screen from its row", async () => {
    await render(<RecordsView />);
    await fireEvent.press(
      screen.getByRole("button", { name: /^Culvert · pipe, / }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/records/[id]",
      params: { id: "culvert" },
    });
  });

  it("points to Capture before the first record", async () => {
    replaceCaptures([]);
    await render(<RecordsView />);
    expect(
      screen.getByText("No records yet. Captures you save appear here."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Today" })).toBeNull();
    expect(screen.getByRole("tab", { name: "All · 0" })).toBeOnTheScreen();
  });
});
