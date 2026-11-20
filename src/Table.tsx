import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Grid } from "./Grid";
import { createRowStore } from "./store";
import { httpApi } from "./api";
import { useUrlQuery } from "./useUrlQuery";
import { PAGE_SIZES } from "./url";
import { STATUSES, type Api, type SortKey, type Status } from "./types";

export function Table({ api = httpApi, height }: { api?: Api; height?: number }) {
  const [query, setQuery] = useUrlQuery();
  const store = useMemo(() => createRowStore(api), [api]);
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    void store.load(query);
  }, [store, query]);

  const pages = Math.max(1, Math.ceil(snap.total / query.pageSize));

  function onSort(key: SortKey) {
    const cur = query.sort;
    const sort =
      cur?.key !== key ? { key, dir: "asc" as const } : cur.dir === "asc" ? { key, dir: "desc" as const } : null;
    setQuery({ ...query, sort, page: 1 });
  }

  return (
    <section aria-label="Table">
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <input
          type="search"
          aria-label="Filter by name"
          placeholder="Filter by name"
          value={query.q}
          onChange={(e) => setQuery({ ...query, q: e.target.value, page: 1 }, { replace: true })}
        />
        <select
          aria-label="Status"
          value={query.status}
          onChange={(e) => setQuery({ ...query, status: e.target.value as Status | "", page: 1 })}
        >
          <option value="">all statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Rows per page"
          value={query.pageSize}
          onChange={(e) => setQuery({ ...query, pageSize: Number(e.target.value), page: 1 })}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} per page
            </option>
          ))}
        </select>
      </div>
      <div role="status" aria-live="polite" style={{ minHeight: 20 }}>
        {snap.status === "loading" && "Loading..."}
        {snap.status === "error" && `Could not load: ${snap.error}`}
        {snap.status === "ready" && `${snap.total} rows`}
        {snap.editError && ` Edit failed and was undone: ${snap.editError}`}
      </div>
      <Grid
        rows={snap.rows}
        total={snap.total}
        offset={(query.page - 1) * query.pageSize}
        sort={query.sort}
        onSort={onSort}
        onEdit={(id, patch) => void store.edit(id, patch)}
        height={height}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button disabled={query.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>
          Previous
        </button>
        <span>
          Page {query.page} of {pages}
        </span>
        <button disabled={query.page >= pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>
          Next
        </button>
      </div>
    </section>
  );
}
