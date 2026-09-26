import { eq } from "drizzle-orm";
import { migrate } from "../Migrate";
import { syncState } from "../schema";
import { openNodeDatabase } from "../testing/NodeDatabase";

describe("Database", () => {
  it("applies the migrations once", async () => {
    const db = await openNodeDatabase(":memory:", { migrated: false });
    expect(await migrate(db)).toBeGreaterThan(0);
    expect(await migrate(db)).toBe(0);
    const tables = await db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "outbox",
        "sync_state",
        "attachments",
        "captures",
      ]),
    );
  });

  it("commits a write and tells listeners of its tables", async () => {
    const db = await openNodeDatabase();
    const listener = jest.fn();
    const other = jest.fn();
    db.onChange(["sync_state"], listener);
    db.onChange(["captures"], other);

    await db.write((tx) =>
      tx
        .insert(syncState)
        .values({ collection: "observations", serverCursor: "c1" }),
    );

    const [row] = await db.orm
      .select()
      .from(syncState)
      .where(eq(syncState.collection, "observations"));
    expect(row.serverCursor).toBe("c1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("rolls back every statement when one fails, and tells no one", async () => {
    const db = await openNodeDatabase();
    const listener = jest.fn();
    db.onChange(["sync_state"], listener);

    await expect(
      db.write(async (tx) => {
        await tx.insert(syncState).values({ collection: "a" });
        await tx.insert(syncState).values({ collection: "a" }); // duplicate key
      }),
    ).rejects.toThrow();

    expect(await db.orm.select().from(syncState)).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});
