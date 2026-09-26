import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { fakeCaptures } from "@/mocks/captures";
import { isOnline$ } from "@/services/storage/NetworkState";
import { syncActivity$ } from "@/services/sync/SyncRuntime";
import type { CaptureSummary } from "@/types/Capture";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { RECORDS_PAGE_SIZE, useRecords } from "../useRecords";

jest.mock("@/services/sync/CaptureSync", () => ({
  syncPendingCaptures: jest.fn(),
}));
const mockRefreshTeam = jest.fn(async () => true);
jest.mock("@/services/sync/ReviewSync", () => ({
  refreshTeamRecords: () => mockRefreshTeam(),
}));
jest.mock("@/services/sync/SyncRuntime", () => ({
  syncActivity$: require("@legendapp/state").observable({
    outbox: false,
    photos: false,
  }),
}));

const CAPTURES = fakeCaptures(new Date(2026, 8, 23, 10, 14));
const ids = (sections: { data: { id: string }[] }[]) =>
  sections.flatMap((s) => s.data.map((c) => c.id));

const getDb = setupTestDatabase();

beforeEach(async () => {
  await seedCaptures(getDb(), CAPTURES);
  isOnline$.set(true);
  syncActivity$.set({ outbox: false, photos: false });
});

async function render(...args: Parameters<typeof useRecords>) {
  const hook = await renderHook(() => useRecords(...args));
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

describe("useRecords", () => {
  it("counts the tabs and lists every record to start with", async () => {
    const { result } = await render();
    await waitFor(() =>
      expect(result.current.counts).toMatchObject({
        all: 14,
        pending: 3,
        flagged: 1,
      }),
    );
    expect(ids(result.current.sections)).toHaveLength(14);
    expect(ids(result.current.sections)[0]).toBe("fake-capture-1"); // newest first
    expect(result.current.online).toBe(true);
    expect(result.current.syncing).toBe(false);
  });

  it("opens on the given tab and narrows by tab and search", async () => {
    const { result } = await render("pending");
    expect(ids(result.current.sections)).toHaveLength(3);
    await act(() => result.current.setQuery("borehole"));
    await waitFor(() =>
      expect(ids(result.current.sections)).toEqual(["fake-capture-3"]),
    );
    await act(() => result.current.setFilter("flagged"));
    await waitFor(() => expect(result.current.sections).toEqual([]));
  });

  it("clears the search when it closes", async () => {
    const { result } = await render("flagged");
    await act(() => result.current.toggleSearch());
    await act(() => result.current.setQuery("pole"));
    expect(result.current.searchOpen).toBe(true);
    await act(() => result.current.toggleSearch());
    expect(result.current.query).toBe("");
    expect(result.current.searchOpen).toBe(false);
  });

  it("follows the database and sync state: new rows appear, syncing, going offline", async () => {
    const { result } = await render();
    await act(() =>
      seedCaptures(getDb(), [
        {
          ...CAPTURES[0],
          id: "new",
          capturedAt: new Date(2026, 8, 23, 11).toISOString(),
        },
      ]),
    );
    await waitFor(() => expect(ids(result.current.sections)[0]).toBe("new"));
    await act(() => syncActivity$.outbox.set(true));
    await waitFor(() => expect(result.current.syncing).toBe(true));
    await act(() => isOnline$.set(false));
    expect(result.current.online).toBe(false);
  });

  it("holds one page at a time and loads the next on demand", async () => {
    const many: CaptureSummary[] = Array.from({ length: 130 }, (_, i) => ({
      ...CAPTURES[0],
      id: `bulk-${String(i).padStart(3, "0")}`,
      capturedAt: new Date(2026, 7, 1, 0, i).toISOString(),
    }));
    await seedCaptures(getDb(), many);
    const { result } = await render();
    expect(ids(result.current.sections)).toHaveLength(RECORDS_PAGE_SIZE);
    expect(result.current.hasMore).toBe(true);
    await act(() => result.current.loadMore());
    expect(ids(result.current.sections)).toHaveLength(2 * RECORDS_PAGE_SIZE);
    await act(() => result.current.loadMore());
    await act(() => result.current.loadMore());
    expect(ids(result.current.sections)).toHaveLength(144);
    expect(result.current.hasMore).toBe(false);
  });

  it("lists the team's records in team scope, keeping Sync now the user's", async () => {
    await seedCaptures(
      getDb(),
      [
        {
          ...CAPTURES[0],
          id: "team-1",
          syncStatus: "synced",
          capturedBy: { id: "enumerator-02", name: "Enumerator 02" },
        },
      ],
      { scope: "team" },
    );
    const { result } = await render("all", "team");
    expect(ids(result.current.sections)).toEqual(["team-1"]);
    await waitFor(() => expect(result.current.ownCounts.pending).toBe(3));
    expect(result.current.counts.pending).toBe(0);

    await act(() => result.current.refreshTeam());
    expect(mockRefreshTeam).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });
});
