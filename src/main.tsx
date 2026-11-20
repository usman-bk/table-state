import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Table } from "./Table";

async function start() {
  // The demo has no backend: msw answers /api in the browser, so it runs offline.
  const { setupWorker } = await import("msw/browser");
  const { createDb, createHandlers } = await import("./mock/handlers");
  await setupWorker(...createHandlers(createDb(50000, 150))).start({ quiet: true });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <h1 style={{ fontFamily: "system-ui", fontSize: 18 }}>table-state demo</h1>
      <p style={{ fontFamily: "system-ui", fontSize: 13 }}>
        Edit a name with Enter. A name containing FAIL is refused by the mock server and the edit is undone.
      </p>
      <Table />
    </StrictMode>,
  );
}

void start();
