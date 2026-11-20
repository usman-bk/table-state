import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseQuery, serializeQuery } from "./url";
import type { Query } from "./types";

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

const getSearch = () => window.location.search;

/**
 * The query lives in the address bar, not in component state, so a reload,
 * a shared link and the back button all land on the same table.
 * `replace` is for typing into the filter box, which should not fill the history.
 */
export function useUrlQuery(): [Query, (next: Query, opts?: { replace?: boolean }) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, () => "");
  const set = useCallback((next: Query, opts?: { replace?: boolean }) => {
    const url = window.location.pathname + serializeQuery(next);
    if (opts?.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    listeners.forEach((l) => l());
  }, []);
  const query = useMemo(() => parseQuery(search), [search]);
  return [query, set];
}
