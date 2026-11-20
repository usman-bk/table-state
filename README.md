# table-state

_Built with AI assistance._

A data table for lists too big to hold in the browser, where the hard part is
the state: sorting, filtering and paging happen on the server and live in the
URL, edits show at once and are undone if the server says no, and answers that
arrive in the wrong order cannot overwrite newer ones.

React 18, TypeScript (strict), Vite, Vitest, Testing Library. The server is an
msw handler set in the repo, so the tests and the demo run offline.

```
src/url.ts          query <-> address bar, bad values fall back to defaults
src/useUrlQuery.ts  the query as external state: pushState, replaceState, popstate
src/store.ts        rows, pending edits and loads, with no React in it
src/Grid.tsx        ARIA grid, roving focus, keyboard, windowed rows
src/Table.tsx       toolbar, pager, glue
src/mock/           50,000 deterministic rows and the msw handlers
```

    npm ci
    npm test          # 43 tests
    npm run dev       # demo on :5173, 150 ms of fake latency, 50,000 rows

In the demo, a name containing `FAIL` is refused by the mock server, which is
the quickest way to watch an edit roll back.

## Numbers

All measured in jsdom with the msw server in-process, so they say nothing about
paint time. Node count and mounted rows do not depend on layout, because the
window is computed from the `height` prop and not from the DOM.

| What | Value |
|---|---|
| Tests | 43 (M) |
| Rows in the dataset | 50,000 (M) |
| Rows mounted in a 400 px grid | 19 at the top (M), 26 in the middle (E, from the node count) |
| DOM elements inside the grid, top / middle / bottom | 103 / 138 / 93 (M) |
| DOM elements in the whole table with one 50,000 row page | 120 (M) |
| Same page rendered row by row, 50,000 rows x (1 row + 4 cells) | about 250,000 elements (E) |
| Fetch, JSON parse and first render of a 50,000 row page | 109 ms (M) |
| Mount of the grid alone, then one jump of 25,000 rows | 44 ms, 23 ms (M) |
| Production bundle, app code | 151 KB, 50 KB gzipped (M) |

The middle of the list is larger than the top because the window has overscan
above as well as below, and the row holding keyboard focus stays mounted (see
below). `src/measure.test.tsx` prints these and fails if the count goes past 150.

## The state, and why it is three things

`store.ts` keeps `base` (what the server last said), `pending` (edits sent and
not answered) and a view that is `base` with `pending` laid over it. The grid
only ever sees the view. Everything below follows from never writing a response
into the place a different response owns.

**Loads carry a number.** Each `load` takes the next integer and only the
newest may write. The test API answers the newer request first and the older
one afterwards, and ignores the abort signal on purpose, because a real server
can still answer a request the client has given up on. Aborting is a courtesy
to the network, the number is what keeps the screen right.

**A failed edit leaves the pending list.** It does not restore a saved copy of
the row. Edit A fails after edit B on the same row succeeded: with a copy, A
puts the original back over B.

**Edits to one row go out one at a time.** Two quick edits to a row, sent
together, can be applied by the server in either order, and the screen would
disagree with the database. Different rows do not wait for each other.

**A load that started before an edit was saved is corrected.** Edits confirmed
while a load is in flight are laid over its result when it lands.

## Problems the tests found

Each was found by a test written against the first version of the code, and
each has its own commit.

1. **A slow response for an old filter overwrote the new rows.** `load` wrote
   whatever came back. Pinned by `a slow response ... arrives last` and the
   stale failure test beside it.
2. **A failed edit wiped a later edit, and a reload undid a saved one.** The
   first store restored a snapshot of the row on failure and replaced the rows
   wholesale on load. Four tests failed at once: rollback after a later success,
   order of requests per row, a reload landing mid-edit, and a reload that
   began before the edit was saved.
3. **Scrolling the focused row out of the window dropped keyboard focus.** The
   browser removes the focused element when its row unmounts, focus falls to
   `<body>`, and the next arrow key goes nowhere. The row with focus is now
   always mounted. This is what adds the extra row to the middle count above.
4. **A page past the end showed an empty table.** `?status=active&page=30` on a
   result with 14 pages returned zero rows and the pager read "Page 30 of 14".
   The table now moves to the last page, replacing the history entry.
5. **The fix for 4 was wrong on the next navigation.** It trusted the page count
   of the result on screen, which after a link or the back button belongs to the
   previous query, so a valid `page=30` was pulled back to page 14. The store
   now records which query its result answers (`loadedFor`) and the clamp waits
   for the match.

One test written along the way was wrong, not the code: it expected amount
ascending to start at 0, and the data's smallest amount is 17.

## Keyboard and ARIA

`role=grid` with `aria-rowcount` and `aria-colcount` set to the real size (50,001
and 4), not the number of mounted rows, and `aria-rowindex` counted from the
start of the whole result, so a screen reader on page 2 says row 502 and not row
2. Headers are `columnheader` with `aria-sort`. One cell has `tabindex=0`.

| Key | Does |
|---|---|
| Arrows | one cell, stopping at the edges |
| Home, End | first and last cell in the row |
| Ctrl+Home, Ctrl+End | the header, the last cell |
| PageUp, PageDown | one screenful, scrolled into view |
| Enter on a header | sort by it |
| Enter or F2 on a cell | edit; Enter saves, Escape leaves, the id is read-only |

## What this does not do

- **No real browser run.** The demo builds and its bundle is in CI, but the
  tests run in jsdom, which has no layout and no scrolling. Scroll position is
  driven by setting `scrollTop` and firing the event. Paint time, scroll jank
  and the msw service worker were not measured.
- **Fixed row height.** Windowing is arithmetic on `rowHeight`. Wrapped text or
  variable rows would need measuring, which this does not do.
- **Screen readers were not run.** The roles and attributes are asserted, but
  no NVDA or VoiceOver pass was done, so "works with a screen reader" is not
  claimed.
- **A 50,000 row page is one request.** It parses in about 100 ms here, but on
  a phone with a real network that is a multi-megabyte JSON body. The server
  paging exists for that reason; virtualisation only fixes the DOM.
- **Edits are lost on reload.** Pending edits live in memory. Closing the tab
  with a request in flight loses it, and there is no retry or offline queue.
- **Last write wins.** Two people editing one row are not detected, there is no
  version or ETag check.
- **Row ids are the key.** The store assumes ids are unique within a page.
- **Filter typing is not debounced.** Each keystroke is a request. Stale ones
  are discarded correctly, but the server still does the work.
