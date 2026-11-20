import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Grid, type GridProps } from "./Grid";
import { makeRows } from "./mock/data";

function setup(over: Partial<GridProps> = {}) {
  const props: GridProps = {
    rows: makeRows(100),
    total: 100,
    offset: 0,
    sort: null,
    onSort: vi.fn(),
    onEdit: vi.fn(),
    height: 320,
    rowHeight: 32,
    ...over,
  };
  const user = userEvent.setup();
  const utils = render(<Grid {...props} />);
  return { props, user, ...utils };
}

const cell = (pos: string) => document.querySelector<HTMLElement>(`[data-pos="${pos}"]`)!;

describe("grid semantics", () => {
  it("announces the real size, not the number of rows that are mounted", () => {
    setup({ rows: makeRows(5000), total: 5000 });
    const grid = screen.getByRole("grid", { name: "Rows" });
    expect(grid).toHaveAttribute("aria-rowcount", "5001");
    expect(grid).toHaveAttribute("aria-colcount", "4");
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(4);
  });

  it("numbers rows by their place in the whole result, not on this page", () => {
    setup({ rows: makeRows(10), total: 1200, offset: 500 });
    const rows = screen.getAllByRole("row");
    expect(rows[0]).toHaveAttribute("aria-rowindex", "1"); // header
    expect(rows[1]).toHaveAttribute("aria-rowindex", "502");
  });

  it("marks the sorted column and only that one", () => {
    setup({ sort: { key: "amount", dir: "desc" } });
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "none");
  });

  it("has exactly one tab stop", () => {
    setup();
    const stops = document.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cell("0:0"));
  });
});

describe("keyboard", () => {
  it("arrow keys move one cell and the tab stop follows", async () => {
    const { user } = setup();
    await user.click(cell("0:0"));
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(cell("1:1")).toHaveFocus();
    expect(cell("1:1")).toHaveAttribute("tabindex", "0");
    expect(cell("0:0")).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(cell("0:0")).toHaveFocus();
  });

  it("stops at the edges instead of wrapping", async () => {
    const { user } = setup();
    await user.click(cell("0:0"));
    await user.keyboard("{ArrowLeft}{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(document.querySelector('[data-pos="-1:0"]'));
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(document.querySelector('[data-pos="-1:0"]'));
  });

  it("Home and End move along the row, Ctrl+Home goes to the header, Ctrl+End to the last cell", async () => {
    const { user } = setup();
    await user.click(cell("2:1"));
    await user.keyboard("{End}");
    expect(cell("2:3")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cell("2:0")).toHaveFocus();
    await user.keyboard("{Control>}{End}{/Control}");
    expect(document.querySelector('[data-pos="99:3"]')).toHaveFocus();
    await user.keyboard("{Control>}{Home}{/Control}");
    expect(document.querySelector('[data-pos="-1:0"]')).toHaveFocus();
  });

  it("PageDown jumps one screenful and scrolls the target into view", async () => {
    const { user } = setup();
    await user.click(cell("0:0"));
    await user.keyboard("{PageDown}");
    expect(document.querySelector('[data-pos="10:0"]')).toHaveFocus();
    expect(screen.getByRole("rowgroup").scrollTop).toBeGreaterThan(0);
  });

  it("Enter on a header sorts by that column", async () => {
    const { user, props } = setup();
    await user.click(cell("0:0"));
    await user.keyboard("{ArrowUp}{ArrowRight}{Enter}");
    expect(props.onSort).toHaveBeenCalledWith("name");
  });

  it("Enter edits a cell, Enter again saves it, and focus returns to the cell", async () => {
    const { user, props } = setup();
    await user.click(cell("3:1"));
    await user.keyboard("{Enter}");
    const input = screen.getByLabelText("Name for row 4");
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "renamed{Enter}");
    expect(props.onEdit).toHaveBeenCalledWith(4, { name: "renamed" });
    expect(screen.queryByLabelText("Name for row 4")).toBeNull();
    expect(cell("3:1")).toHaveFocus();
  });

  it("Escape abandons an edit without calling anything", async () => {
    const { user, props } = setup();
    await user.click(cell("3:1"));
    await user.keyboard("{Enter}x{Escape}");
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(cell("3:1")).toHaveFocus();
  });

  it("the id column is read-only", async () => {
    const { user } = setup();
    await user.click(cell("3:0"));
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an amount that is not a number keeps the editor open", async () => {
    const { user, props } = setup();
    await user.click(cell("3:3"));
    await user.keyboard("{Enter}");
    const input = screen.getByLabelText("Amount for row 4");
    await user.clear(input);
    await user.type(input, "12x{Enter}");
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(input).toBeInTheDocument();
  });

  it("typing arrow keys inside the editor moves the caret, not the grid", async () => {
    const { user } = setup();
    await user.click(cell("3:1"));
    await user.keyboard("{Enter}{ArrowLeft}{ArrowDown}");
    expect(screen.getByLabelText("Name for row 4")).toHaveFocus();
  });
});

describe("virtualisation", () => {
  it("mounts a screenful of rows, not the whole list", () => {
    setup({ rows: makeRows(50000), total: 50000 });
    const mounted = screen.getAllByRole("row").length - 1;
    expect(mounted).toBeLessThanOrEqual(10 + 6);
    expect(mounted).toBeGreaterThan(0);
  });

  it("scrolling swaps the rows that are mounted", () => {
    setup({ rows: makeRows(50000), total: 50000 });
    const scroller = screen.getByRole("rowgroup");
    scroller.scrollTop = 32 * 20000;
    fireEvent.scroll(scroller);
    expect(screen.queryByText("alder-harbor-1")).toBeNull();
    expect(document.querySelector('[data-pos="20000:0"]')).toHaveTextContent("20001");
  });
});
