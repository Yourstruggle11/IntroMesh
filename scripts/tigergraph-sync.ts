import { loadEnv } from "./_env";

loadEnv();

async function main() {
  const { fullSync } = await import("../src/lib/graph");
  const r = await fullSync();
  console.log(`✓ Synced ${r.nodes} vertices and ${r.edges} edges.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
