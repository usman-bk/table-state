import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "./Table";
import { useDb } from "./test/server";

const firstCol = (col: number) =>
  Array.from(document.querySelectorAll(`[role="row"] [role="gridcell"][data-pos$=":${col}"]`)).map(
    (c) => c.textContent,
  );

async function ready(total: string | RegExp) {
  await screen.findByText(total);
}

describe("table against the mock server", () => {
  it("loads the first page and says how many rows match", async () => {
    useDb(2000);
    render(<Table height={320} />);
    await ready("2000 rows");
    expect(screen.getByText("Page 1 of 4")).toBeInTheDocument();
    expect(firstCol(0).slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  it("clicking a header sorts on the server and puts the sort in the URL", async () => {
    useDb(2000);
    const user = userEvent.setup();
    render(<Table height={320} />);
    await ready("2000 rows");
    await user.click(screen.getByRole("columnheader", { name: /Amount/ }));
    await waitFor(() => expect(window.location.search).toBe("?sort=amount%3Aasc"));
    await waitFor(() => expect(window.location.search).toBe("?sort=amount%3Aasc"));
    await waitFor(() => expect(Number(firstCol(3)[0])).toBeLessThan(Number(firstCol(3)[1]) + 1));
    const lowest = Number(firstCol(3)[0]);
    expect(lowest).toBeLessThan(200);
    await user.click(screen.getByRole("columnheader", { name: /Amount/ }));
    expect(window.location.search).toBe("?sort=amount%3Adesc");
    await waitFor(() => expect(Number(firstCol(3)[0])).toBeGreaterThan(99000));
    await user.click(screen.getByRole("columnheader", { name: /Amount/ }));
    expect(window.location.search).toBe("");
  });

  it("a link with the state in it opens on that state", async () => {
    useDb(2000);
    window.history.replaceState(null, "", "/?sort=amount:desc&status=paused&pageSize=50");
    render(<Table height={320} />);
    await ready("667 rows");
    expect(screen.getByLabelText("Status")).toHaveValue("paused");
    expect(screen.getByLabelText("Rows per page")).toHaveValue("50");
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "descending");
    expect(Number(firstCol(3)[0])).toBeGreaterThan(99000);
  });

  it("typing in the filter replaces the history entry instead of adding one per key", async () => {
    useDb(2000);
    const user = userEvent.setup();
    render(<Table height={320} />);
    await ready("2000 rows");
    const before = window.history.length;
    await user.type(screen.getByLabelText("Filter by name"), "alder");
    expect(window.history.length).toBe(before);
    expect(window.location.search).toBe("?q=alder");
    await waitFor(() => expect(screen.getByText(/^\d+ rows$/).textContent).not.toBe("2000 rows"));
  });

  it("the back button returns to the previous sort", async () => {
    useDb(2000);
    const user = userEvent.setup();
    render(<Table height={320} />);
    await ready("2000 rows");
    await user.click(screen.getByRole("columnheader", { name: /Name/ }));
    await waitFor(() => expect(window.location.search).toContain("sort=name"));
    act(() => window.history.back());
    await waitFor(() => expect(window.location.search).toBe(""));
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "none"),
    );
  });

  it("a page number past the end after narrowing the filter lands on the last page, not an empty one", async () => {
    useDb(2000);
    window.history.replaceState(null, "", "/?pageSize=50&status=active&page=30");
    render(<Table height={320} />);
    await screen.findByText("Page 14 of 14");
    expect(window.location.search).toBe("?status=active&page=14&pageSize=50");
    await waitFor(() => expect(firstCol(0).length).toBeGreaterThan(0));
  });

  it("the clamp judges a page by the result it belongs to, not the previous one", async () => {
    useDb(2000);
    window.history.replaceState(null, "", "/?pageSize=50&status=active");
    render(<Table height={320} />);
    await screen.findByText("Page 1 of 14");
    // follow a link to page 30 of the unfiltered list: 40 pages, so 30 is valid
    act(() => {
      window.history.pushState(null, "", "/?pageSize=50&page=30");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByText("Page 30 of 40");
    expect(window.location.search).toBe("?pageSize=50&page=30");
  });

  it("changing the filter goes back to page 1", async () => {
    useDb(2000);
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?pageSize=50&page=3");
    render(<Table height={320} />);
    await screen.findByText("Page 3 of 40");
    await user.selectOptions(screen.getByLabelText("Status"), "closed");
    await screen.findByText("Page 1 of 14");
  });
});

describe("editing against the mock server", () => {
  it("a saved edit stays and reaches the server", async () => {
    const db = useDb(200);
    const user = userEvent.setup();
    render(<Table height={320} />);
    await ready("200 rows");
    await user.click(document.querySelector<HTMLElement>('[data-pos="0:1"]')!);
    await user.keyboard("{Enter}");
    const input = screen.getByLabelText("Name for row 1");
    await user.clear(input);
    await user.type(input, "kept{Enter}");
    expect(document.querySelector('[data-pos="0:1"]')).toHaveTextContent("kept");
    await waitFor(() => expect(db.rows[0]!.name).toBe("kept"));
  });

  it("a refused edit shows at once and is undone with a message", async () => {
    const db = useDb(200, 150);
    const original = db.rows[0]!.name;
    const user = userEvent.setup();
    render(<Table height={320} />);
    await ready("200 rows");
    await user.click(document.querySelector<HTMLElement>('[data-pos="0:1"]')!);
    await user.keyboard("{Enter}");
    const input = screen.getByLabelText("Name for row 1");
    await user.clear(input);
    await user.type(input, "FAIL me{Enter}");
    expect(document.querySelector('[data-pos="0:1"]')).toHaveTextContent("FAIL me");
    await waitFor(() => expect(document.querySelector('[data-pos="0:1"]')).toHaveTextContent(original));
    expect(within(screen.getByRole("status")).getByText(/Edit failed and was undone/)).toBeInTheDocument();
    expect(db.rows[0]!.name).toBe(original);
  });
});
