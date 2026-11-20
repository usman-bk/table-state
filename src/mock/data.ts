import { STATUSES, type Row } from "../types";

const WORDS = ["alder", "birch", "cedar", "dune", "ember", "fjord", "glade", "harbor", "isle", "juniper", "knoll", "lagoon"];

/** Deterministic, so a test and the README both talk about the same 50,000 rows. */
export function makeRows(n: number): Row[] {
  const rows: Row[] = [];
  for (let i = 1; i <= n; i++) {
    rows.push({
      id: i,
      name: `${WORDS[i % WORDS.length]}-${WORDS[(i * 7) % WORDS.length]}-${i}`,
      status: STATUSES[i % STATUSES.length] as Row["status"],
      amount: (i * 7919) % 100000,
    });
  }
  return rows;
}
