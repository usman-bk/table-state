import { fireEvent, render, screen } from "@testing-library/react";
import { Grid } from "./Grid";
import { makeRows } from "./mock/data";

/**
 * The numbers quoted in the README. Run `npx vitest run src/measure.test.tsx`
 * to print them. The bounds are generous: they catch a regression to
 * "render everything", not a change of a few nodes.
 */
describe("what 50,000 rows cost in the DOM", () => {
  it("keeps the node count flat from the top to the bottom of the list", () => {
    const rows = makeRows(50000);
    const t0 = performance.now();
    const { container } = render(
      <Grid rows={rows} total={50000} offset={0} sort={null} onSort={() => {}} onEdit={() => {}} height={400} />,
    );
    const mountMs = performance.now() - t0;
    const count = () => container.querySelectorAll("*").length;
    const top = count();
    const mountedRows = screen.getAllByRole("row").length - 1;

    const scroller = screen.getByRole("rowgroup");
    const s0 = performance.now();
    scroller.scrollTop = 32 * 25000;
    fireEvent.scroll(scroller);
    const scrollMs = performance.now() - s0;
    const middle = count();
    scroller.scrollTop = 32 * 49990;
    fireEvent.scroll(scroller);
    const bottom = count();

    console.log(
      JSON.stringify({ rows: 50000, mountedRows, nodesTop: top, nodesMiddle: middle, nodesBottom: bottom, mountMs: Math.round(mountMs), scrollMs: Math.round(scrollMs) }),
    );
    // The middle holds overscan rows above and below plus the pinned focus row;
    // the top has no rows above it, the bottom none below.
    expect(Math.max(top, middle, bottom)).toBeLessThan(150);
    expect(mountedRows).toBeLessThan(30);
  });
});
