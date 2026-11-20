import { STATUSES, type Query, type SortDir, type SortKey, type Status } from "./types";

export const DEFAULT_PAGE_SIZE = 500;
export const PAGE_SIZES = [50, 500, 50000] as const;
const SORT_KEYS: SortKey[] = ["id", "name", "status", "amount"];

export const DEFAULT_QUERY: Query = {
  sort: null,
  q: "",
  status: "",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/** Anything in the address bar is untrusted: unknown values fall back to the default. */
export function parseQuery(search: string): Query {
  const p = new URLSearchParams(search);
  const sortRaw = p.get("sort") ?? "";
  const [key, dir] = sortRaw.split(":");
  const sort =
    SORT_KEYS.includes(key as SortKey) && (dir === "asc" || dir === "desc")
      ? { key: key as SortKey, dir: dir as SortDir }
      : null;
  const status = p.get("status") ?? "";
  const page = Number.parseInt(p.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(p.get("pageSize") ?? "", 10);
  return {
    sort,
    q: p.get("q") ?? "",
    status: (STATUSES as readonly string[]).includes(status) ? (status as Status) : "",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

/** Defaults are left out so the common URL stays short. */
export function serializeQuery(query: Query): string {
  const p = new URLSearchParams();
  if (query.sort) p.set("sort", `${query.sort.key}:${query.sort.dir}`);
  if (query.q) p.set("q", query.q);
  if (query.status) p.set("status", query.status);
  if (query.page > 1) p.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) p.set("pageSize", String(query.pageSize));
  const s = p.toString();
  return s ? `?${s}` : "";
}
