import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __intromeshDb: DB | undefined;
  var __intromeshDbDriver: "postgres" | "pglite" | undefined;
}

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    globalThis.__intromeshDbDriver = "postgres";
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15 });
    return drizzle(client, { schema });
  }
  globalThis.__intromeshDbDriver = "pglite";
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add your Supabase connection string to the Vercel environment.");
  }
  // Local development: embedded Postgres (PGlite) persisted in ./.pglite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR || "./.pglite");
  // The query-builder API is identical; only the driver differs.
  return drizzlePglite(client, { schema }) as unknown as DB;
}

function getDb(): DB {
  return (globalThis.__intromeshDb ??= createDb());
}

/** Lazily connects on first use (so importing this module never opens a connection, e.g. during `next build`). */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

/** Reflects the driver actually in use (falls back to env before first connection). */
export function usingEmbeddedDb() {
  return (globalThis.__intromeshDbDriver ?? (process.env.DATABASE_URL ? "postgres" : "pglite")) === "pglite";
}
