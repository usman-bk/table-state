import { createRowStore } from "./store";
import { DEFAULT_QUERY } from "./url";
import { controlledApi, row, tick } from "./test/helpers";

const q = (name: string) => ({ ...DEFAULT_QUERY, q: name });

describe("loading", () => {
  it("a stale response that arrives last does not overwrite the newer one", async () => {
    const { api, fetches } = controlledApi();
    const store = createRowStore(api);
    void store.load(q("a"));
    void store.load(q("ab"));
    // the newer request answers first, the older one limps in afterwards
    fetches[1]!.d.resolve({ rows: [row(2, { name: "ab-new" })], total: 1 });
    await tick();
    fetches[0]!.d.resolve({ rows: [row(1, { name: "a-old" }), row(3)], total: 2 });
    await tick();
    expect(store.getSnapshot().rows.map((r) => r.name)).toEqual(["ab-new"]);
    expect(store.getSnapshot().total).toBe(1);
    expect(store.getSnapshot().status).toBe("ready");
  });

  it("a stale failure does not turn a good newer result into an error", async () => {
    const { api, fetches } = controlledApi();
    const store = createRowStore(api);
    void store.load(q("a"));
    void store.load(q("ab"));
    fetches[1]!.d.resolve({ rows: [row(2)], total: 1 });
    await tick();
    fetches[0]!.d.reject(new Error("boom"));
    await tick();
    expect(store.getSnapshot().status).toBe("ready");
    expect(store.getSnapshot().error).toBeNull();
  });

  it("an error keeps the rows already on screen", async () => {
    const { api, fetches } = controlledApi();
    const store = createRowStore(api);
    void store.load(q("a"));
    fetches[0]!.d.resolve({ rows: [row(1)], total: 1 });
    await tick();
    void store.load(q("b"));
    fetches[1]!.d.reject(new Error("offline"));
    await tick();
    expect(store.getSnapshot().status).toBe("error");
    expect(store.getSnapshot().rows).toHaveLength(1);
  });
});
