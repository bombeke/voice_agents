import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { isOnline$ } from "@/services/storage/NetworkState";
import { addTeamRecords } from "@/services/storage/ReviewStore";
import type { CaptureSummary } from "@/types/Capture";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { RecordsView } from "../RecordsView";

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
const mockRefreshTeam = jest.fn(async () => true);
jest.mock("@/services/sync/ReviewSync", () => ({
  refreshTeamRecords: () => mockRefreshTeam(),
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const label = (title: string) => new RegExp(`^${title.replace(/[·]/g, ".")}, `);
const row = (title: string) => screen.getByLabelText(label(title));
const findRow = (title: string) => screen.findByLabelText(label(title));

const getDb = setupTestDatabase();

beforeEach(() => {
  mockRefreshTeam.mockClear();
  isOnline$.set(true);
});

/** The list with the given records stored, once its first page is in. */
async function renderList(
  props: Parameters<typeof RecordsView>[0] = {},
  records: CaptureSummary[] = RECORDS,
) {
  await seedCaptures(getDb(), records);
  await render(<RecordsView {...props} />);
  await screen.findByRole("tab", { name: `All · ${records.length}` });
}

describe("RecordsView", () => {
  it("groups records by day under the sync banner and tabs", async () => {
    await renderList();
    expect(await findRow("Concrete pole")).toBeOnTheScreen();
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
    await renderList();
    await fireEvent.press(
      await screen.findByRole("tab", { name: "Pending · 2" }),
    );
    expect(await findRow("Borehole · hand pump")).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText("Culvert · pipe")).toBeNull(),
    );

    await fireEvent.press(screen.getByRole("tab", { name: "Flagged · 1" }));
    expect(await screen.findByText("Culvert · pipe")).toBeOnTheScreen();

    await act(() =>
      seedCaptures(
        getDb(),
        RECORDS.map((r) => ({ ...r, flagged: false })),
      ),
    );
    expect(await screen.findByText("No flagged records.")).toBeOnTheScreen();
  });

  it("searches records and clears the search on close", async () => {
    await renderList();
    await fireEvent.press(
      screen.getByRole("button", { name: "Search records" }),
    );
    const field = screen.getByLabelText("Search by name, ID or category");
    await fireEvent.changeText(field, "ep-00412");
    await waitFor(() =>
      expect(screen.queryByText("Culvert · pipe")).toBeNull(),
    );
    expect(screen.getByText("Concrete pole")).toBeOnTheScreen();
    await fireEvent.changeText(field, "tower");
    expect(
      await screen.findByText("No records match your search."),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Close search" }));
    expect(await screen.findByText("Culvert · pipe")).toBeOnTheScreen();
  });

  it("settles with Sync now and hides the banner once all is synced", async () => {
    // Nothing is left queued for these rows, so Sync now settles them.
    await renderList();
    await fireEvent.press(
      await screen.findByRole("button", { name: "Sync now" }),
    );
    await waitFor(() =>
      expect(row("Concrete pole")).toHaveAccessibleName(/Synced$/),
    );
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Pending · 0" })).toBeOnTheScreen();
  });

  it("keeps records pending and says so while offline", async () => {
    isOnline$.set(false);
    await renderList();
    expect(
      await screen.findByText("No network · photos upload on Wi-Fi"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
    expect(await findRow("Concrete pole")).toHaveAccessibleName(/Pending$/);
  });

  it("opens on the tab from the route", async () => {
    await renderList({ filter: "flagged" });
    expect(
      await screen.findByRole("tab", { name: "Flagged · 1", selected: true }),
    ).toBeOnTheScreen();
  });

  it("opens a record's detail screen from its row", async () => {
    await renderList();
    await fireEvent.press(
      await screen.findByRole("button", { name: /^Culvert · pipe, / }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/records/[id]",
      params: { id: "culvert" },
    });
  });

  it("points to Capture before the first record", async () => {
    await renderList({}, []);
    expect(
      await screen.findByText("No records yet. Captures you save appear here."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Today" })).toBeNull();
    expect(screen.getByRole("tab", { name: "All · 0" })).toBeOnTheScreen();
  });

  it("has no Mine / Team switch for an enumerator", async () => {
    await renderList();
    expect(screen.queryByRole("tab", { name: "Team" })).toBeNull();
    expect(mockRefreshTeam).not.toHaveBeenCalled();
  });

  it("switches a supervisor to the team's records", async () => {
    const enumerator = { id: "enumerator-04", name: "Enumerator 04" };
    await addTeamRecords([
      {
        summary: {
          ...record({
            id: "team-transformer",
            title: "Transformer",
            capturedAt: today(0, 5),
          }),
          capturedBy: enumerator,
        },
        record: { id: "team-transformer" } as never,
      },
    ]);
    await renderList({ canSeeTeam: true });
    expect(screen.getByRole("tab", { name: "Mine" })).toBeSelected();
    expect(screen.queryByText("Transformer")).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Team" }));
    expect(mockRefreshTeam).toHaveBeenCalled();
    expect(await findRow("Transformer")).toHaveAccessibleName(
      /^Transformer, Enumerator 04 · \d\d:\d\d · ±2\.8 m, Synced$/,
    );
    await waitFor(() => expect(screen.queryByText("Concrete pole")).toBeNull());
    // Uploads stay about the supervisor's own records.
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
    expect(screen.getByRole("tab", { name: "All · 1" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Mine" }));
    expect(
      await screen.findByText("2 records waiting to upload"),
    ).toBeOnTheScreen();
  });

  it("says when no team records are downloaded yet", async () => {
    await renderList({ canSeeTeam: true });
    await fireEvent.press(screen.getByRole("tab", { name: "Team" }));
    expect(
      await screen.findByText(
        "No team records here yet. Pull down to fetch them when online.",
      ),
    ).toBeOnTheScreen();
  });
});
