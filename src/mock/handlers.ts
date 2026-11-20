import { http, HttpResponse, delay } from "msw";
import { STATUSES, type Row, type Patch } from "../types";
import { makeRows } from "./data";

export interface MockDb {
  rows: Row[];
  /** artificial latency in ms, 0 in tests */
  latency: number;
}

export function createDb(n = 50000, latency = 0): MockDb {
  return { rows: makeRows(n), latency };
}

/**
 * Same contract the real component expects:
 *   GET   /api/rows?sort=amount:desc&q=ab&status=paused&page=2&pageSize=500
 *   PATCH /api/rows/:id   {name?, status?, amount?}
 * A name containing "FAIL" is refused with 500, so the demo can show a rollback.
 */
export function createHandlers(db: MockDb) {
  return [
    http.get("/api/rows", async ({ request }) => {
      const u = new URL(request.url);
      if (db.latency) await delay(db.latency);
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      const status = u.searchParams.get("status") ?? "";
      const [key, dir] = (u.searchParams.get("sort") ?? "").split(":");
      const page = Math.max(1, Number(u.searchParams.get("page") ?? 1));
      const pageSize = Math.min(50000, Math.max(1, Number(u.searchParams.get("pageSize") ?? 500)));

      let out = db.rows.filter(
        (r) => (!q || r.name.toLowerCase().includes(q)) && (!status || r.status === status),
      );
      if (key && (dir === "asc" || dir === "desc")) {
        const k = key as keyof Row;
        const sign = dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = a[k];
          const bv = b[k];
          const c = av < bv ? -1 : av > bv ? 1 : 0;
          return c !== 0 ? c * sign : a.id - b.id;
        });
      }
      const start = (page - 1) * pageSize;
      return HttpResponse.json({ rows: out.slice(start, start + pageSize), total: out.length });
    }),

    http.patch("/api/rows/:id", async ({ request, params }) => {
      if (db.latency) await delay(db.latency);
      const id = Number(params.id);
      const patch = (await request.json()) as Patch;
      const row = db.rows.find((r) => r.id === id);
      if (!row) return HttpResponse.json({ error: "not found" }, { status: 404 });
      if (patch.name !== undefined && (patch.name.trim() === "" || patch.name.includes("FAIL"))) {
        return HttpResponse.json({ error: "name refused" }, { status: patch.name.trim() === "" ? 422 : 500 });
      }
      if (patch.status !== undefined && !(STATUSES as readonly string[]).includes(patch.status)) {
        return HttpResponse.json({ error: "bad status" }, { status: 422 });
      }
      if (patch.amount !== undefined && !Number.isFinite(patch.amount)) {
        return HttpResponse.json({ error: "bad amount" }, { status: 422 });
      }
      Object.assign(row, patch);
      return HttpResponse.json(row);
    }),
  ];
}
