import { fakeMapAssets } from "@/mocks/assets";
import { fakeCaptures } from "@/mocks/captures";
import { fakeRecords } from "@/mocks/records";
import {
  replaceCaptures,
  setCaptureStatus,
} from "@/services/storage/CaptureStore";
import { replaceRecords, upsertRecord } from "@/services/storage/RecordStore";
import { act, renderHook } from "@testing-library/react-native";
import { useRecordDetail } from "../useRecordDetail";

// mocks/captures reads the network flag; the real module opens sync timers.
jest.mock("@/services/storage/LegendState", () => ({
  isOnline$: require("@legendapp/state").observable(true),
}));

const NOW = new Date(2026, 8, 22, 10, 14);
const CAPTURES = fakeCaptures(NOW);
const RECORDS = fakeRecords(CAPTURES, fakeMapAssets(NOW));

beforeEach(() => {
  replaceCaptures(CAPTURES);
  replaceRecords(RECORDS);
});

describe("useRecordDetail", () => {
  it("finds a record by capture id with its sync state and history", async () => {
    const { result } = await renderHook(() =>
      useRecordDetail("fake-capture-1"),
    );
    expect(result.current?.record.title).toBe("Concrete pole");
    expect(result.current?.summary.syncStatus).toBe("pending");
    expect(result.current?.history.map((h) => h.current)).toEqual([
      true,
      false,
    ]);
  });

  it("finds an asset's newest capture by its code", async () => {
    const { result } = await renderHook(() => useRecordDetail("EP-00412"));
    expect(result.current?.record.id).toBe("fake-capture-1");
  });

  it("is null for a record that isn't on the device", async () => {
    const { result } = await renderHook(() => useRecordDetail("nope"));
    expect(result.current).toBeNull();
  });

  it("follows the stores", async () => {
    const { result } = await renderHook(() =>
      useRecordDetail("fake-capture-1"),
    );
    await act(() => setCaptureStatus(["fake-capture-1"], "synced"));
    expect(result.current?.summary.syncStatus).toBe("synced");
    await act(() =>
      upsertRecord({ ...result.current!.record, comment: "Fixed." }),
    );
    expect(result.current?.record.comment).toBe("Fixed.");
  });
});
