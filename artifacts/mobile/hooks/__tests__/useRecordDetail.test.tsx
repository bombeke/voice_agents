import { captures } from "@/db/schema";
import { seedCaptures, setupTestDatabase } from "@/db/testing/TestDb";
import { fakeMapAssets } from "@/mocks/assets";
import { fakeCaptures } from "@/mocks/captures";
import { fakeRecords } from "@/mocks/records";
import {
  captureRow,
  upsertOwnCaptures,
} from "@/services/storage/repos/CaptureRepo";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { eq } from "drizzle-orm";
import { useRecordDetail } from "../useRecordDetail";

const NOW = new Date(2026, 8, 22, 10, 14);
const CAPTURES = fakeCaptures(NOW);
const RECORDS = fakeRecords(CAPTURES, fakeMapAssets(NOW));
const byId = Object.fromEntries(RECORDS.map((r) => [r.id, r]));

const getDb = setupTestDatabase();

beforeEach(async () => {
  await seedCaptures(getDb(), CAPTURES, { records: byId });
  // The earlier inspection of EP-00412 (a record without a row of today's list).
  const previous = RECORDS.find(
    (r) => r.id === "fake-record-ep-00412-previous",
  )!;
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

async function render(id: string) {
  const hook = await renderHook(() => useRecordDetail(id));
  await waitFor(() => expect(hook.result.current).not.toBeUndefined());
  return hook;
}

describe("useRecordDetail", () => {
  it("finds a record by capture id with its sync state and history", async () => {
    const hook = await render("fake-capture-1");
    expect(hook.result.current?.record.title).toBe("Concrete pole");
    expect(hook.result.current?.summary.syncStatus).toBe("pending");
    expect(hook.result.current?.history.map((h) => h.current)).toEqual([
      true,
      false,
    ]);
    expect(hook.result.current?.own).toBe(true);
  });

  it("finds an asset's newest capture by its code", async () => {
    const { result } = await render("EP-00412");
    expect(result.current?.record.id).toBe("fake-capture-1");
  });

  it("is null for a record that isn't on the device", async () => {
    const { result } = await render("nope");
    expect(result.current).toBeNull();
  });

  it("reads a downloaded team record, read-only", async () => {
    await seedCaptures(getDb(), [{ ...CAPTURES[1], id: "team-1" }], {
      scope: "team",
      records: { "team-1": { ...byId["fake-capture-2"], id: "team-1" } },
    });
    const { result } = await render("team-1");
    expect(result.current).toMatchObject({ own: false, history: [] });
  });

  it("follows the database", async () => {
    const { result } = await render("fake-capture-1");
    await act(async () => {
      const [row] = await getDb()
        .orm.select()
        .from(captures)
        .where(eq(captures.id, "fake-capture-1"));
      await getDb().write((tx) =>
        upsertOwnCaptures(tx, [
          captureRow(
            { ...row.summary, syncStatus: "synced" },
            { ...row.record!, comment: "Fixed." },
            "mine",
            1,
          ),
        ]),
      );
    });
    await waitFor(() =>
      expect(result.current?.summary.syncStatus).toBe("synced"),
    );
    expect(result.current?.record.comment).toBe("Fixed.");
  });
});
