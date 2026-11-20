import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";

// Node's fetch refuses relative URLs; a browser resolves them against the page.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === "string" && input.startsWith("/") ? window.location.origin + input : input, init)) as typeof fetch;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.history.replaceState(null, "", "/");
});
afterAll(() => server.close());
