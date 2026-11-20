import { createRowStore } from "./store";
import { DEFAULT_QUERY } from "./url";
import { controlledApi, row, tick } from "./test/helpers";

async function loaded(rows = [row(1), row(2)]) {
  const ctl = controlledApi();
  const store = createRowStore(ctl.api);
  void store.load(DEFAULT_QUERY);
  ctl.fetches[0]!.d.resolve({ rows, total: rows.length });
  await tick();
  return { ...ctl, store };
}

describe("optimistic edits", () => {
  it("shows the new value at once and keeps the server's answer on success", async () => {
    const { store, patches } = await loaded();
    const done = store.edit(1, { name: "typed" });
    expect(store.getSnapshot().rows[0]!.name).toBe("typed");
    patches[0]!.d.resolve(row(1, { name: "typed" }));
    expect(await done).toBe(true);
    expect(store.getSnapshot().rows[0]!.name).toBe("typed");
  });

  it("puts the old value back when the server refuses", async () => {
    const { store, patches } = await loaded();
    const done = store.edit(1, { name: "typed" });
    patches[0]!.d.reject(new Error("500"));
    expect(await done).toBe(false);
    expect(store.getSnapshot().rows[0]!.name).toBe("row-1");
    expect(store.getSnapshot().editError).toBe("500");
  });

  it("rolling back an early failed edit does not wipe a later edit that succeeded", async () => {
    const { store, patches } = await loaded();
    const a = store.edit(1, { name: "first" });
    const b = store.edit(1, { name: "second" });
    // the second edit may not be sent until the first has settled
    expect(patches).toHaveLength(1);
    patches[0]!.d.reject(new Error("500"));
    await a;
    await tick();
    expect(patches).toHaveLength(2);
    patches[1]!.d.resolve(row(1, { name: "second" }));
    await b;
    expect(store.getSnapshot().rows[0]!.name).toBe("second");
  });

  it("edits to the same row reach the server in the order they were made", async () => {
    const { store, patches } = await loaded();
    void store.edit(1, { name: "one" });
    void store.edit(1, { amount: 5 });
    expect(patches.map((p) => p.patch)).toEqual([{ name: "one" }]);
    patches[0]!.d.resolve(row(1, { name: "one" }));
    await tick();
    expect(patches.map((p) => p.patch)).toEqual([{ name: "one" }, { amount: 5 }]);
  });

  it("edits to different rows do not wait for each other", async () => {
    const { store, patches } = await loaded();
    void store.edit(1, { name: "one" });
    void store.edit(2, { name: "two" });
    expect(patches).toHaveLength(2);
  });

  it("a reload that lands while an edit is in flight does not undo the edit", async () => {
    const { store, patches, fetches } = await loaded();
    void store.edit(1, { name: "typed" });
    void store.load(DEFAULT_QUERY);
    fetches[1]!.d.resolve({ rows: [row(1), row(2)], total: 2 });
    await tick();
    expect(store.getSnapshot().rows[0]!.name).toBe("typed");
    patches[0]!.d.resolve(row(1, { name: "typed" }));
    await tick();
    expect(store.getSnapshot().rows[0]!.name).toBe("typed");
  });

  it("a reload that began before the edit was saved does not bring the old value back", async () => {
    const { store, patches, fetches } = await loaded();
    void store.load(DEFAULT_QUERY); // server reads the table now, before the edit
    const done = store.edit(1, { name: "typed" });
    patches[0]!.d.resolve(row(1, { name: "typed" }));
    await done;
    fetches[1]!.d.resolve({ rows: [row(1), row(2)], total: 2 }); // old snapshot arrives late
    await tick();
    expect(store.getSnapshot().rows[0]!.name).toBe("typed");
  });

  it("editing a row that is not on screen is refused without a request", async () => {
    const { store, patches } = await loaded();
    expect(await store.edit(99, { name: "x" })).toBe(false);
    expect(patches).toHaveLength(0);
  });
});
