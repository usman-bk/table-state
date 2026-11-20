import { DEFAULT_QUERY, parseQuery, serializeQuery } from "./url";
import type { Query } from "./types";

describe("query in the URL", () => {
  it("an empty address is the default query", () => {
    expect(parseQuery("")).toEqual(DEFAULT_QUERY);
    expect(serializeQuery(DEFAULT_QUERY)).toBe("");
  });

  it("round-trips every field", () => {
    const q: Query = { sort: { key: "amount", dir: "desc" }, q: "ab", status: "paused", page: 3, pageSize: 50 };
    expect(parseQuery(serializeQuery(q))).toEqual(q);
  });

  it("round-trips a filter full of characters that mean something in a URL", () => {
    const q: Query = { ...DEFAULT_QUERY, q: "a&b=c #1 100% é" };
    expect(parseQuery(serializeQuery(q)).q).toBe(q.q);
  });

  it("falls back to defaults for hand-edited garbage", () => {
    const q = parseQuery("?sort=password:asc&status=deleted&page=-4&pageSize=999999");
    expect(q).toEqual(DEFAULT_QUERY);
    expect(parseQuery("?page=abc").page).toBe(1);
    expect(parseQuery("?sort=name:sideways").sort).toBeNull();
  });
});
