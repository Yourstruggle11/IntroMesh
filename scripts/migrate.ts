import { loadEnv } from "./_env";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
    console.log("✓ Migrated Postgres database");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(process.env.PGLITE_DIR || "./.pglite");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.close();
    console.log("✓ Migrated embedded PGlite database (./.pglite)");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
