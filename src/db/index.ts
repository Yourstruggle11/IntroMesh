import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
type Sql = postgres.Sql;

declare global {
  var __intromeshDb: DB | undefined;
  var __intromeshSql: Sql | undefined;
  var __intromeshDbDriver: "postgres" | "pglite" | undefined;
}

/**
 * A query that hasn't answered by now is stuck, not slow: our queries take milliseconds in-region.
 * The usual cause on Vercel is a pooled socket that died while the instance was frozen.
 */
const QUERY_TIMEOUT_MS = 6000;
const RETRYABLE = new Set(["DB_QUERY_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "EPIPE", "ETIMEDOUT"]);

class QueryTimeoutError extends Error {
  code = "DB_QUERY_TIMEOUT";
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new QueryTimeoutError(`Database query timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Throw away a client whose connections are stuck; the next query opens fresh ones. */
function discard(sql: Sql) {
  if (globalThis.__intromeshSql === sql) {
    globalThis.__intromeshSql = undefined;
    globalThis.__intromeshDb = undefined;
  }
  sql.end({ timeout: 0 }).catch(() => undefined);
}

/**
 * Gives every query drizzle sends a deadline. On a timeout or a dropped connection the client is
 * replaced, and reads are retried once on the fresh connection; writes surface the error instead of
 * risking a double write.
 */
function guard(sql: Sql): Sql {
  const unsafe = (query: string, params?: unknown[], opts?: unknown) => {
    let values = false;
    // postgres.js queries are lazy thenables: nothing is sent until they're awaited.
    const run = (client: Sql) => {
      const q = (client.unsafe as (...a: unknown[]) => postgres.PendingQuery<postgres.Row[]>)(query, params, opts);
      return values ? q.values() : q;
    };
    const settle = () =>
      withTimeout(run(sql), QUERY_TIMEOUT_MS).catch(async (err: { code?: string; message?: string }) => {
        if (!RETRYABLE.has(err?.code ?? "")) throw err;
        discard(sql);
        if (!/^\s*select\b/i.test(query)) throw err;
        console.warn(`[db] ${err.code}: retrying read on a fresh connection`);
        const fresh = rawClient();
        try {
          return await withTimeout(run(fresh), QUERY_TIMEOUT_MS);
        } catch (again) {
          if (RETRYABLE.has((again as { code?: string })?.code ?? "")) discard(fresh);
          throw again;
        }
      });
    const pending = {
      values() {
        values = true;
        return pending;
      },
      then<A, B>(onOk?: (v: unknown) => A | PromiseLike<A>, onErr?: (e: unknown) => B | PromiseLike<B>) {
        return settle().then(onOk, onErr);
      },
    };
    return pending;
  };
  return new Proxy(sql, { get: (target, prop, receiver) => (prop === "unsafe" ? unsafe : Reflect.get(target, prop, receiver)) });
}

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    globalThis.__intromeshDbDriver = "postgres";
    // One query per connection at a time: the Supabase pooler can stall on pipelined queries.
    // (postgres.js reads `max_pipeline` at runtime but leaves it out of its types.)
    const noPipelining = { max_pipeline: 0 } as object;
    const sql = postgres(url, {
      prepare: false, // Supabase transaction pooler (port 6543) does not support prepared statements.
      max: 5,
      idle_timeout: 15, // close idle sockets quickly; frozen serverless instances leave them dead
      max_lifetime: 60 * 10,
      connect_timeout: 10,
      ...noPipelining,
    });
    globalThis.__intromeshSql = sql;
    // drizzle installs its type parsers on the client it wraps, so every new client gets a new drizzle.
    return drizzle(guard(sql), { schema });
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

/** The current postgres.js client (creating it, with drizzle's parsers installed, if needed). */
function rawClient(): Sql {
  getDb();
  return globalThis.__intromeshSql!;
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
