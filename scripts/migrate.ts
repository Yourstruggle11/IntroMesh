import { loadEnv } from "./_env";

loadEnv();

const NETWORK_ERRORS = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH/;

async function migratePostgres(url: string) {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 20 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

async function main() {
  const direct = process.env.DATABASE_URL_DIRECT;
  const pooled = process.env.DATABASE_URL;
  if (direct || pooled) {
    // Supabase direct hosts are often IPv6-only; fall back to the pooler if they're unreachable.
    const candidates = [direct, pooled].filter((u, i, a): u is string => Boolean(u) && a.indexOf(u) === i);
    let lastErr: unknown;
    for (const url of candidates) {
      try {
        await migratePostgres(url);
        console.log(`✓ Migrated Postgres database (${url === direct ? "direct" : "pooler"} connection)`);
        return;
      } catch (err) {
        lastErr = err;
        const msg = String((err as { cause?: Error })?.cause?.message ?? (err as Error)?.message ?? err);
        if (!NETWORK_ERRORS.test(msg)) throw err;
        console.warn(`! ${url === direct ? "Direct" : "Pooler"} connection unreachable (${msg.slice(0, 80)}), trying next…`);
      }
    }
    throw lastErr;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR || "./.pglite");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.close();
  console.log("✓ Migrated embedded PGlite database (./.pglite)");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
