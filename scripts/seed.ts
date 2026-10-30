/**
 * LOCAL DEMO DATA ONLY. Creates sample members, QR connections and private contacts
 * so the graph, discovery and recommendations can be tested end to end.
 * Refuses to run against a remote database unless --allow-remote is passed:
 * never present seeded accounts as real traction.
 */
import { loadEnv } from "./_env";

loadEnv();

const PEOPLE = [
  { name: "Ravi Iyer", role: "Founder", company: "Settlr", headline: "Stablecoin payroll on Base", tags: ["payments", "stablecoins", "base"], lookingFor: ["seed investor", "design partner"], canIntroduce: ["polygon bd"] },
  { name: "Priya Shah", role: "Builder", company: "Lumen Labs", headline: "Privacy-first wallets", tags: ["privacy", "wallets", "monero"], lookingFor: ["devrel", "cake wallet team"], canIntroduce: ["zk researchers"] },
  { name: "Arjun Mehta", role: "BD Lead", company: "Dodo Payments", headline: "Payments for a borderless world", tags: ["payments", "bd", "saas"], lookingFor: ["saas founders"], canIntroduce: ["payments investors", "fintech founders"] },
  { name: "Maya Kapoor", role: "Partner", company: "Northstar Seed Fund", headline: "Investing in AI x payments", tags: ["investor", "seed", "payments", "ai"], lookingFor: ["payments founders", "ai agents"], canIntroduce: ["angel investors"] },
  { name: "Leo Fernandes", role: "DevRel", company: "TigerGraph", headline: "Graphs for everyone", tags: ["graph", "devrel", "databases"], lookingFor: ["graph use cases"], canIntroduce: ["tigergraph engineers"] },
  { name: "Sara Khan", role: "Product Designer", company: "Freelance", headline: "Design for crypto UX", tags: ["design", "ux", "crypto"], lookingFor: ["early-stage founders"], canIntroduce: ["designers"] },
  { name: "Dev Patel", role: "CTO", company: "AgentKit", headline: "Autonomous AI agents onchain", tags: ["ai agents", "llm", "base"], lookingFor: ["seed investor", "devrel"], canIntroduce: ["ai engineers"] },
  { name: "Ananya Rao", role: "Growth", company: "Edge City", headline: "Community for builders", tags: ["community", "growth"], lookingFor: ["community builders"], canIntroduce: ["edge city residents"] },
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [1, 4],
  [4, 6],
  [5, 0],
  [6, 7],
  [2, 7],
];

async function main() {
  if (process.env.DATABASE_URL && !process.argv.includes("--allow-remote")) {
    console.error("Refusing to seed a remote database. This script is for local development only.");
    process.exit(1);
  }
  const { db } = await import("../src/db");
  const { users, connections, contacts } = await import("../src/db/schema");
  const { hash } = await import("bcryptjs");
  const { connectCode } = await import("../src/lib/activity");
  const { eq } = await import("drizzle-orm");
  const pw = await hash("demo-password", 10);
  const ids: string[] = [];
  for (const p of PEOPLE) {
    const email = `${p.name.split(" ")[0].toLowerCase()}@demo.intromesh.local`;
    const [ex] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (ex) {
      ids.push(ex.id);
      continue;
    }
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash: pw, name: p.name, role: p.role, company: p.company, headline: p.headline, tags: p.tags, lookingFor: p.lookingFor, canIntroduce: p.canIntroduce, connectCode: connectCode(), onboarded: true })
      .returning({ id: users.id });
    ids.push(u.id);
  }
  for (const [a, b] of EDGES) {
    const [x, y] = [ids[a], ids[b]].sort();
    await db.insert(connections).values({ userA: x, userB: y, source: "qr" }).onConflictDoNothing();
  }
  // Arjun (Dodo) privately knows a payments VC; Leo (TigerGraph) knows a graph PM.
  await db
    .insert(contacts)
    .values([
      { ownerId: ids[2], name: "Kiran Desai", email: "kiran@demo-fund.local", company: "Ledger Ventures", role: "General Partner", tags: ["investor", "payments", "seed"], strength: 5 },
      { ownerId: ids[4], name: "Nina Oberoi", email: "nina@demo-graph.local", company: "TigerGraph", role: "Product Manager", tags: ["graph", "product"], strength: 4 },
    ])
    .onConflictDoNothing();
  console.log(`✓ Seeded ${ids.length} demo members (password: demo-password), ${EDGES.length} connections, 2 private contacts.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
