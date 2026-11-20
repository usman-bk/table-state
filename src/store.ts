import type { Api, Patch, Query, Row } from "./types";
import { serializeQuery } from "./url";

export interface Snapshot {
  /** what the user sees: server rows with unconfirmed edits laid over them */
  rows: Row[];
  total: number;
  /** the query the rows and total answer, which may lag the one in the URL */
  loadedFor: string | null;
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

interface Pending {
  key: number;
  id: number;
  patch: Patch;
}

/**
 * Three things are kept apart so that no response can undo the wrong thing:
 *   base     the last rows the server told us about
 *   pending  edits sent and not yet answered, in the order they were made
 *   view     base with pending laid over it, which is all the UI ever sees
 * A failed edit leaves the pending list, it never restores a copy of the row,
 * so it cannot wipe an edit that was made after it and succeeded.
 */
export function createRowStore(api: Api): RowStore {
  let base: Row[] = [];
  let pending: Pending[] = [];
  let state: Snapshot = { rows: [], total: 0, loadedFor: null, status: "idle", error: null, editError: null };
  const listeners = new Set<() => void>();

  // Each load takes a number. Only the newest number may write to the state.
  let loadSeq = 0;
  let abort: AbortController | null = null;

  // Edits confirmed while a load is in flight. That load may have read the
  // table before the edit was saved, so they are laid over its result.
  let confirmed: { id: number; patch: Patch }[] = [];

  let pendingKey = 0;
  const chains = new Map<number, Promise<unknown>>();

  const overlay = (rows: Row[], edits: { id: number; patch: Patch }[]): Row[] => {
    if (edits.length === 0) return rows;
    const byId = new Map<number, Patch[]>();
    for (const e of edits) byId.set(e.id, [...(byId.get(e.id) ?? []), e.patch]);
    return rows.map((r) => {
      const ps = byId.get(r.id);
      return ps ? ps.reduce<Row>((acc, p) => ({ ...acc, ...p }), r) : r;
    });
  };

  function publish(next: Partial<Omit<Snapshot, "rows">> = {}) {
    state = { ...state, ...next, rows: overlay(base, pending) };
    listeners.forEach((l) => l());
  }

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
      confirmed = [];
      publish({ status: "loading", error: null });
      try {
        const page = await api.fetchRows(query, abort.signal);
        if (mine !== loadSeq) return;
        base = overlay(page.rows, confirmed);
        confirmed = [];
        publish({ total: page.total, loadedFor: serializeQuery(query), status: "ready" });
      } catch (e) {
        if (mine !== loadSeq) return;
        publish({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    edit(id, patch) {
      if (!base.some((r) => r.id === id)) return Promise.resolve(false);
      const entry: Pending = { key: ++pendingKey, id, patch };
      pending = [...pending, entry];
      publish({ editError: null });

      // One request at a time per row, so the server applies them in the order
      // the user made them. Rows do not wait for each other.
      const send = async (): Promise<boolean> => {
        try {
          const saved = await api.patchRow(id, patch);
          pending = pending.filter((p) => p.key !== entry.key);
          base = base.map((r) => (r.id === id ? saved : r));
          if (state.status === "loading") confirmed.push({ id, patch });
          publish();
          return true;
        } catch (e) {
          pending = pending.filter((p) => p.key !== entry.key);
          publish({ editError: e instanceof Error ? e.message : String(e) });
          return false;
        }
      };
      const prev = chains.get(id);
      const result = prev ? prev.then(send) : send();
      chains.set(id, result);
      void result.then(() => {
        if (chains.get(id) === result) chains.delete(id);
      });
      return result;
    },
  };
}
