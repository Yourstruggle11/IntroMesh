import "server-only";
import { db } from "@/db";
import { connections, contacts, users } from "@/db/schema";

export type NodeId = string; // "u:<uuid>" | "c:<uuid>"
export const userNode = (id: string) => `u:${id}`;
export const contactNode = (id: string) => `c:${id}`;
export const isUserNode = (n: NodeId) => n.startsWith("u:");
export const rawId = (n: NodeId) => n.slice(2);

export type Edge = { a: NodeId; b: NodeId; strength: number; source: "qr" | "code" | "contact" };

export type Reach = Map<NodeId, { depth: number; parents: NodeId[] }>;

export type GraphSnapshot = {
  nodes: { id: NodeId; kind: "user" | "contact"; name: string; company: string | null; role: string | null }[];
  edges: Edge[];
};

/**
 * Builds the relationship graph from Postgres (source of truth).
 * Private contacts whose email matches a member are linked to that member directly.
 */
export async function loadGraph(): Promise<GraphSnapshot> {
  const [us, cs, cons] = await Promise.all([
    db.select({ id: users.id, email: users.email, name: users.name, company: users.company, role: users.role }).from(users),
    db.select({ id: contacts.id, ownerId: contacts.ownerId, email: contacts.email, name: contacts.name, company: contacts.company, role: contacts.role, strength: contacts.strength }).from(contacts),
    db.select({ a: connections.userA, b: connections.userB, strength: connections.strength, source: connections.source }).from(connections),
  ]);
  const userByEmail = new Map(us.map((u) => [u.email.toLowerCase(), u.id]));
  const nodes: GraphSnapshot["nodes"] = us.map((u) => ({ id: userNode(u.id), kind: "user", name: u.name, company: u.company, role: u.role }));
  const edges: Edge[] = cons.map((c) => ({ a: userNode(c.a), b: userNode(c.b), strength: c.strength, source: c.source === "code" ? "code" : "qr" }));
  const seenPairs = new Set(edges.map((e) => [e.a, e.b].sort().join("|")));

  for (const c of cs) {
    const memberId = userByEmail.get(c.email.toLowerCase());
    if (memberId && memberId !== c.ownerId) {
      const pair = [userNode(c.ownerId), userNode(memberId)].sort().join("|");
      if (!seenPairs.has(pair)) {
        seenPairs.add(pair);
        edges.push({ a: userNode(c.ownerId), b: userNode(memberId), strength: c.strength, source: "contact" });
      }
      continue;
    }
    if (memberId === c.ownerId) continue;
    nodes.push({ id: contactNode(c.id), kind: "contact", name: c.name, company: c.company, role: c.role });
    edges.push({ a: userNode(c.ownerId), b: contactNode(c.id), strength: c.strength, source: "contact" });
  }
  return { nodes, edges };
}

/** Breadth-first search keeping every parent at the previous depth (all shortest paths). */
export function bfs(edges: Edge[], src: NodeId, maxHops: number): Reach {
  const adj = new Map<NodeId, NodeId[]>();
  for (const e of edges) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push(e.b);
    adj.get(e.b)!.push(e.a);
  }
  const reach: Reach = new Map([[src, { depth: 0, parents: [] }]]);
  let frontier: NodeId[] = [src];
  for (let depth = 1; depth <= maxHops && frontier.length; depth++) {
    const next: NodeId[] = [];
    for (const s of frontier) {
      // Private contacts are leaves: never route through them.
      if (s !== src && !isUserNode(s)) continue;
      for (const t of adj.get(s) ?? []) {
        const r = reach.get(t);
        if (!r) {
          reach.set(t, { depth, parents: [s] });
          next.push(t);
        } else if (r.depth === depth && !r.parents.includes(s)) {
          r.parents.push(s);
        }
      }
    }
    frontier = next;
  }
  return reach;
}

/** Reconstruct up to `limit` shortest paths src → … → target from parent pointers. */
export function pathsTo(reach: Reach, target: NodeId, limit = 3): NodeId[][] {
  const out: NodeId[][] = [];
  const walk = (node: NodeId, acc: NodeId[]) => {
    if (out.length >= limit) return;
    const r = reach.get(node);
    if (!r) return;
    if (r.depth === 0) {
      out.push([node, ...acc]);
      return;
    }
    for (const p of r.parents) walk(p, [node, ...acc]);
  };
  walk(target, []);
  return out;
}
