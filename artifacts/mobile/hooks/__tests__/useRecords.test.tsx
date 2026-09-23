import { fakeCaptures } from "@/mocks/captures";
import {
  replaceCaptures,
  setCaptureStatus,
} from "@/services/storage/CaptureStore";
import { isOnline$ } from "@/services/storage/LegendState";
import { act, renderHook } from "@testing-library/react-native";
import { useRecords } from "../useRecords";

jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));
jest.mock("@/services/sync/CaptureSync", () => ({
  syncPendingCaptures: jest.fn(),
}));

const CAPTURES = fakeCaptures(new Date(2026, 8, 23, 10, 14));
const ids = (sections: { data: { id: string }[] }[]) =>
  sections.flatMap((s) => s.data.map((c) => c.id));

beforeEach(() => {
  replaceCaptures(CAPTURES);
  isOnline$.set(true);
});

describe("useRecords", () => {
  it("counts the tabs and lists every record to start with", async () => {
    const { result } = await renderHook(() => useRecords());
    expect(result.current.counts).toMatchObject({
      all: 14,
      pending: 3,
      flagged: 1,
    });
    expect(ids(result.current.sections)).toHaveLength(14);
    expect(result.current.online).toBe(true);
    expect(result.current.syncing).toBe(false);
  });

  it("opens on the given tab and narrows by tab and search", async () => {
    const { result } = await renderHook(() => useRecords("pending"));
    expect(ids(result.current.sections)).toHaveLength(3);
    await act(() => result.current.setQuery("borehole"));
    expect(ids(result.current.sections)).toEqual(["fake-capture-3"]);
    await act(() => result.current.setFilter("flagged"));
    expect(result.current.sections).toEqual([]);
  });

  it("clears the search when it closes, and reset shows everything", async () => {
    const { result } = await renderHook(() => useRecords("flagged"));
    await act(() => result.current.toggleSearch());
    await act(() => result.current.setQuery("pole"));
    expect(result.current.searchOpen).toBe(true);
    await act(() => result.current.toggleSearch());
    expect(result.current.query).toBe("");

    await act(() => result.current.reset());
    expect(result.current.filter).toBe("all");
    expect(ids(result.current.sections)).toHaveLength(14);
  });

  it("follows the store: syncing while any record uploads, and going offline", async () => {
    const { result } = await renderHook(() => useRecords());
    await act(() => setCaptureStatus(["fake-capture-1"], "uploading"));
    expect(result.current.syncing).toBe(true);
    await act(() => isOnline$.set(false));
    expect(result.current.online).toBe(false);
  });
});
