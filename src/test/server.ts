import { setupServer } from "msw/node";
import { createDb, createHandlers, type MockDb } from "../mock/handlers";

export const server = setupServer();

export function useDb(n = 2000, latency = 0): MockDb {
  const db = createDb(n, latency);
  server.use(...createHandlers(db));
  return db;
}
