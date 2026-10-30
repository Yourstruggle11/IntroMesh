import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contacts, users } from "@/db/schema";
import { bfs, contactNode, isUserNode, loadGraph, rawId, userNode, type GraphSnapshot, type NodeId, type Reach } from "./model";
import { tgClearAll, tgConfigured, tgDeleteEdge, tgDeleteVertex, tgReachable, tgUpsert } from "./tigergraph";

export * from "./model";

export type NodeInfo = {
  id: NodeId;
  kind: "user" | "contact";
  name: string;
  company: string | null;
  role: string | null;
  headline: string | null;
  tags: string[];
  lookingFor: string[];
  canIntroduce: string[];
  ownerId: string | null; // for contacts
};

export type ReachResult = { reach: Reach; engine: "tigergraph" | "postgres"; ms: number; fallbackReason?: string };

export async function reachable(userId: string, maxHops = 3): Promise<ReachResult> {
  const src = userNode(userId);
  const t0 = performance.now();
  if (tgConfigured()) {
    try {
      const reach = await tgReachable(src, maxHops);
      return { reach, engine: "tigergraph", ms: Math.round(performance.now() - t0) };
    } catch (err) {
      console.warn("[graph] TigerGraph query failed, using Postgres fallback:", (err as Error).message);
      const snap = await loadGraph();
      return { reach: bfs(snap.edges, src, maxHops), engine: "postgres", ms: Math.round(performance.now() - t0), fallbackReason: (err as Error).message };
    }
  }
  const snap = await loadGraph();
  return { reach: bfs(snap.edges, src, maxHops), engine: "postgres", ms: Math.round(performance.now() - t0) };
}

/** Load display + matching details for graph nodes from Postgres. */
export async function nodeDetails(ids: NodeId[]): Promise<Map<NodeId, NodeInfo>> {
  const userIds = ids.filter(isUserNode).map(rawId);
  const contactIds = ids.filter((i) => !isUserNode(i)).map(rawId);
  const out = new Map<NodeId, NodeInfo>();
  if (userIds.length) {
    const rows = await db
      .select({ id: users.id, name: users.name, company: users.company, role: users.role, headline: users.headline, tags: users.tags, lookingFor: users.lookingFor, canIntroduce: users.canIntroduce })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const r of rows) out.set(userNode(r.id), { id: userNode(r.id), kind: "user", name: r.name, company: r.company, role: r.role, headline: r.headline, tags: r.tags, lookingFor: r.lookingFor, canIntroduce: r.canIntroduce, ownerId: null });
  }
  if (contactIds.length) {
    const rows = await db
      .select({ id: contacts.id, name: contacts.name, company: contacts.company, role: contacts.role, tags: contacts.tags, ownerId: contacts.ownerId })
      .from(contacts)
      .where(inArray(contacts.id, contactIds));
    for (const r of rows) out.set(contactNode(r.id), { id: contactNode(r.id), kind: "contact", name: r.name, company: r.company, role: r.role, headline: null, tags: r.tags, lookingFor: [], canIntroduce: [], ownerId: r.ownerId });
  }
  return out;
}

/* ───────────────────────── Sync to TigerGraph (best effort) ───────────────────────── */

async function safe(label: string, fn: () => Promise<void>) {
  if (!tgConfigured()) return;
  try {
    await fn();
  } catch (err) {
    console.warn(`[graph:sync] ${label} failed:`, (err as Error).message);
  }
}

export function syncUser(userId: string) {
  return safe("user", async () => {
    const [u] = await db.select({ id: users.id, name: users.name, company: users.company, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (u) await tgUpsert([{ id: userNode(u.id), kind: "user", name: u.name, company: u.company, role: u.role }], []);
  });
}

export function syncConnection(a: string, b: string, strength: number, source: "qr" | "code") {
  return safe("connection", () => tgUpsert([], [{ a: userNode(a), b: userNode(b), strength, source }]));
}

export function unsyncConnection(a: string, b: string) {
  return safe("connection-delete", () => tgDeleteEdge(userNode(a), userNode(b)));
}

/** Re-sync one contact (handles the "contact is actually a member" case). */
export function syncContact(contactId: string) {
  return safe("contact", async () => {
    const [c] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (!c) return;
    const [member] = await db.select({ id: users.id }).from(users).where(eq(users.email, c.email.toLowerCase())).limit(1);
    if (member && member.id !== c.ownerId) {
      await tgUpsert([], [{ a: userNode(c.ownerId), b: userNode(member.id), strength: c.strength, source: "contact" }]);
    } else if (!member) {
      await tgUpsert(
        [{ id: contactNode(c.id), kind: "contact", name: c.name, company: c.company, role: c.role }],
        [{ a: userNode(c.ownerId), b: contactNode(c.id), strength: c.strength, source: "contact" }],
      );
    }
  });
}

export function unsyncContact(contactId: string) {
  return safe("contact-delete", () => tgDeleteVertex(contactNode(contactId)));
}

/** Full rebuild from Postgres. Returns counts. */
export async function fullSync(): Promise<{ nodes: number; edges: number }> {
  const snap: GraphSnapshot = await loadGraph();
  if (!tgConfigured()) return { nodes: snap.nodes.length, edges: snap.edges.length };
  await tgClearAll().catch(() => undefined);
  await tgUpsert(snap.nodes, snap.edges);
  return { nodes: snap.nodes.length, edges: snap.edges.length };
}
