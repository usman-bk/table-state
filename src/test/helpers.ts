import type { Api, Page, Patch, Query, Row } from "../types";

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(v: T): void;
  reject(e: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

export const row = (id: number, over: Partial<Row> = {}): Row => ({
  id,
  name: `row-${id}`,
  status: "active",
  amount: id * 10,
  ...over,
});

/**
 * An Api where the test decides when, and in what order, each call answers.
 * It ignores the abort signal on purpose: a real server can still answer a
 * request the client gave up on, and the store must cope with that.
 */
export function controlledApi() {
  const fetches: { query: Query; d: Deferred<Page> }[] = [];
  const patches: { id: number; patch: Patch; d: Deferred<Row> }[] = [];
  const api: Api = {
    fetchRows(query) {
      const d = deferred<Page>();
      fetches.push({ query, d });
      return d.promise;
    },
    patchRow(id, patch) {
      const d = deferred<Row>();
      patches.push({ id, patch, d });
      return d.promise;
    },
  };
  return { api, fetches, patches };
}

export const tick = () => new Promise<void>((r) => setTimeout(r, 0));
