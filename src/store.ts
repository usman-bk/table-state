import type { Api, Patch, Query, Row } from "./types";

export interface Snapshot {
  rows: Row[];
  total: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** text of the last failed edit, cleared by the next edit */
  editError: string | null;
}

export interface RowStore {
  getSnapshot(): Snapshot;
  subscribe(cb: () => void): () => void;
  load(query: Query): Promise<void>;
  edit(id: number, patch: Patch): Promise<boolean>;
}

export function createRowStore(api: Api): RowStore {
  let state: Snapshot = { rows: [], total: 0, status: "idle", error: null, editError: null };
  const listeners = new Set<() => void>();
  // Each load takes a number. Only the newest number may write to the state.
  let loadSeq = 0;
  let abort: AbortController | null = null;

  function set(next: Partial<Snapshot>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  }

  const mapRow = (id: number, fn: (r: Row) => Row) =>
    state.rows.map((r) => (r.id === id ? fn(r) : r));

  return {
    getSnapshot: () => state,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async load(query) {
      const mine = ++loadSeq;
      abort?.abort();
      abort = new AbortController();
      set({ status: "loading", error: null });
      try {
        const page = await api.fetchRows(query, abort.signal);
        if (mine !== loadSeq) return;
        set({ rows: page.rows, total: page.total, status: "ready" });
      } catch (e) {
        if (mine !== loadSeq) return;
        set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    async edit(id, patch) {
      const before = state.rows.find((r) => r.id === id);
      if (!before) return false;
      set({ rows: mapRow(id, (r) => ({ ...r, ...patch })), editError: null });
      try {
        const saved = await api.patchRow(id, patch);
        set({ rows: mapRow(id, () => saved) });
        return true;
      } catch (e) {
        set({
          rows: mapRow(id, () => before),
          editError: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    },
  };
}
