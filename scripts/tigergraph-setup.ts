import { loadEnv } from "./_env";

loadEnv();

async function main() {
  const { gsql, queryGsql, schemaGsql, tgConfigured, tgPing } = await import("../src/lib/graph/tigergraph");
  if (!tgConfigured()) throw new Error("Set TG_HOST and TG_SECRET (or TG_USERNAME/TG_PASSWORD) in .env.local.");
  console.log("→ Creating schema…");
  try {
    console.log(await gsql(schemaGsql()));
  } catch (e) {
    console.warn("Schema step:", (e as Error).message);
  }
  console.log("→ Installing warm_paths query (this can take a minute)…");
  console.log(await gsql(queryGsql(), 300_000));
  console.log("→ Pinging RESTPP with secret token…");
  console.log((await tgPing()) ? "✓ RESTPP reachable" : "✗ RESTPP ping failed");
  console.log("Done. Run `npm run graph:sync` to load data.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
