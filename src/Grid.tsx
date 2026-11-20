import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { EditableKey, Patch, Row, SortKey, Query } from "./types";

interface Column {
  key: SortKey;
  label: string;
  editable: boolean;
}

export const COLUMNS: Column[] = [
  { key: "id", label: "ID", editable: false },
  { key: "name", label: "Name", editable: true },
  { key: "status", label: "Status", editable: true },
  { key: "amount", label: "Amount", editable: true },
];

export interface GridProps {
  rows: Row[];
  /** rows on the server for this filter, not just this page */
  total: number;
  /** how many rows precede this page, so aria-rowindex is absolute */
  offset: number;
  sort: Query["sort"];
  onSort(key: SortKey): void;
  onEdit(id: number, patch: Patch): void;
  height?: number;
  rowHeight?: number;
  overscan?: number;
  label?: string;
}

interface Pos {
  row: number; // -1 is the header row
  col: number;
}

export function Grid({
  rows,
  total,
  offset,
  sort,
  onSort,
  onEdit,
  height = 400,
  rowHeight = 32,
  overscan = 6,
  label = "Rows",
}: GridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState<Pos>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<Pos | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);

  const n = rows.length;
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(n, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  // The row holding focus stays mounted even when scrolled far away. If the
  // browser removes the focused element, focus falls back to <body> and the
  // next arrow key goes nowhere.
  const indices: number[] = [];
  for (let i = first; i < last; i++) indices.push(i);
  if (active.row >= 0 && active.row < n && (active.row < first || active.row >= last)) {
    indices.push(active.row);
  }
  const visible = Math.max(1, Math.floor(height / rowHeight));

  function move(next: Pos) {
    const row = Math.min(n - 1, Math.max(-1, next.row));
    const col = Math.min(COLUMNS.length - 1, Math.max(0, next.col));
    wantFocus.current = true;
    setActive({ row, col });
    if (row >= 0 && scroller.current) {
      const top = row * rowHeight;
      let st = scrollTop;
      if (top < st) st = top;
      else if (top + rowHeight > st + height) st = top + rowHeight - height;
      if (st !== scrollTop) {
        scroller.current.scrollTop = st;
        setScrollTop(st);
      }
    }
  }

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    root.current
      ?.querySelector<HTMLElement>(`[data-pos="${active.row}:${active.col}"]`)
      ?.focus();
  });

  function onKeyDown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const { row, col } = active;
    const ctrl = e.ctrlKey || e.metaKey;
    switch (e.key) {
      case "ArrowDown":
        return stop(e, () => move({ row: row + 1, col }));
      case "ArrowUp":
        return stop(e, () => move({ row: row - 1, col }));
      case "ArrowRight":
        return stop(e, () => move({ row, col: col + 1 }));
      case "ArrowLeft":
        return stop(e, () => move({ row, col: col - 1 }));
      case "PageDown":
        return stop(e, () => move({ row: Math.max(row, 0) + visible, col }));
      case "PageUp":
        return stop(e, () => move({ row: row - visible, col }));
      case "Home":
        return stop(e, () => move(ctrl ? { row: -1, col: 0 } : { row, col: 0 }));
      case "End":
        return stop(e, () => move(ctrl ? { row: n - 1, col: COLUMNS.length - 1 } : { row, col: COLUMNS.length - 1 }));
      case "Enter":
      case "F2":
        if (row === -1) return stop(e, () => onSort(COLUMNS[col]!.key));
        if (COLUMNS[col]!.editable) return stop(e, () => setEditing({ row, col }));
    }
  }

  function commit(r: Row, key: EditableKey, raw: string) {
    const value = key === "amount" ? Number(raw) : raw;
    if (key === "amount" && (raw.trim() === "" || Number.isNaN(value))) return;
    wantFocus.current = true;
    setEditing(null);
    if (r[key] !== value) onEdit(r.id, { [key]: value } as Patch);
  }

  const ariaSort = (k: SortKey) =>
    sort?.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div
      ref={root}
      role="grid"
      aria-label={label}
      aria-rowcount={total + 1}
      aria-colcount={COLUMNS.length}
      onKeyDown={onKeyDown}
      style={{ width: 560, border: "1px solid #bbb", fontFamily: "system-ui", fontSize: 14 }}
    >
      <div role="row" aria-rowindex={1} style={{ display: "flex", height: rowHeight, background: "#f3f3f3" }}>
        {COLUMNS.map((c, ci) => (
          <div
            key={c.key}
            role="columnheader"
            aria-colindex={ci + 1}
            aria-sort={ariaSort(c.key)}
            data-pos={`-1:${ci}`}
            tabIndex={active.row === -1 && active.col === ci ? 0 : -1}
            onFocus={() => setActive({ row: -1, col: ci })}
            onClick={() => onSort(c.key)}
            style={{ flex: 1, padding: "0 8px", lineHeight: `${rowHeight}px`, cursor: "pointer", fontWeight: 600 }}
          >
            {c.label}
            {sort?.key === c.key ? (sort.dir === "asc" ? " ^" : " v") : ""}
          </div>
        ))}
      </div>
      <div
        ref={scroller}
        role="rowgroup"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ height, overflow: "auto", position: "relative" }}
      >
        <div style={{ height: n * rowHeight, position: "relative" }}>
          {indices.map((i) => {
            const r = rows[i]!;
            return (
              <div
                key={r.id}
                role="row"
                aria-rowindex={offset + i + 2}
                style={{ position: "absolute", top: i * rowHeight, height: rowHeight, left: 0, right: 0, display: "flex" }}
              >
                {COLUMNS.map((c, ci) => {
                  const isActive = active.row === i && active.col === ci;
                  const isEditing = editing?.row === i && editing.col === ci;
                  return (
                    <div
                      key={c.key}
                      role="gridcell"
                      aria-colindex={ci + 1}
                      data-pos={`${i}:${ci}`}
                      tabIndex={isActive ? 0 : -1}
                      onFocus={() => setActive({ row: i, col: ci })}
                      onDoubleClick={() => c.editable && setEditing({ row: i, col: ci })}
                      style={{ flex: 1, padding: "0 8px", lineHeight: `${rowHeight}px`, overflow: "hidden", whiteSpace: "nowrap" }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          aria-label={`${c.label} for row ${r.id}`}
                          defaultValue={String(r[c.key])}
                          style={{ width: "100%", boxSizing: "border-box" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commit(r, c.key as EditableKey, e.currentTarget.value);
                            if (e.key === "Escape") {
                              wantFocus.current = true;
                              setEditing(null);
                            }
                          }}
                          onBlur={() => setEditing(null)}
                        />
                      ) : (
                        String(r[c.key])
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function stop(e: KeyboardEvent, fn: () => void) {
  e.preventDefault();
  fn();
}
