export const STATUSES = ["active", "paused", "closed"] as const;
export type Status = (typeof STATUSES)[number];

export interface Row {
  id: number;
  name: string;
  status: Status;
  amount: number;
}

export type Patch = Partial<Pick<Row, "name" | "status" | "amount">>;
export type EditableKey = keyof Patch;

export type SortKey = "id" | "name" | "status" | "amount";
export type SortDir = "asc" | "desc";

export interface Query {
  sort: { key: SortKey; dir: SortDir } | null;
  q: string;
  status: Status | "";
  page: number;
  pageSize: number;
}

export interface Page {
  rows: Row[];
  total: number;
}

export interface Api {
  fetchRows(query: Query, signal?: AbortSignal): Promise<Page>;
  patchRow(id: number, patch: Patch): Promise<Row>;
}
