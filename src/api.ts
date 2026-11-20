import type { Api, Page, Patch, Query, Row } from "./types";

export function toParams(q: Query): string {
  const p = new URLSearchParams();
  if (q.sort) p.set("sort", `${q.sort.key}:${q.sort.dir}`);
  if (q.q) p.set("q", q.q);
  if (q.status) p.set("status", q.status);
  p.set("page", String(q.page));
  p.set("pageSize", String(q.pageSize));
  return p.toString();
}

export const httpApi: Api = {
  async fetchRows(query, signal) {
    const res = await fetch(`/api/rows?${toParams(query)}`, { signal });
    if (!res.ok) throw new Error(`rows: ${res.status}`);
    return (await res.json()) as Page;
  },
  async patchRow(id, patch: Patch) {
    const res = await fetch(`/api/rows/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`patch ${id}: ${res.status}`);
    return (await res.json()) as Row;
  },
};
