import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { introRequests, users, type User } from "@/db/schema";
import { expandQuery } from "@/lib/ai";
import { isUserNode, nodeDetails, pathsTo, rawId, reachable, userNode, type NodeId, type NodeInfo } from "@/lib/graph";
import { OPEN_STATUSES } from "@/lib/intros";
import { maskName } from "@/lib/utils";

export type PublicNode = {
  id: NodeId;
  kind: "user" | "contact";
  name: string;
  role: string | null;
  company: string | null;
  headline: string | null;
  tags: string[];
  masked: boolean;
};

export type DiscoverPath = { nodes: PublicNode[]; connector: PublicNode };

export type DiscoverResult = {
  key: string;
  target: PublicNode;
  hops: number;
  paths: DiscoverPath[];
  score: number;
  matched: string[];
  signals: string[];
  alreadyConnected: boolean;
  openRequest: { id: string; status: string } | null;
};

export type ColdResult = { target: PublicNode; matched: string[] };

export type DiscoverResponse = {
  query: string;
  keywords: string[];
  engine: "tigergraph" | "postgres";
  ms: number;
  reachable: number;
  results: DiscoverResult[];
  cold: ColdResult[];
};

function toPublic(n: NodeInfo): PublicNode {
  const masked = n.kind === "contact";
  return {
    id: n.id,
    kind: n.kind,
    name: masked ? maskName(n.name) : n.name,
    role: n.role,
    company: n.company,
    headline: masked ? null : n.headline,
    tags: n.tags.slice(0, 6),
    masked,
  };
}

const FIELDS: { key: keyof NodeInfo; weight: number }[] = [
  { key: "name", weight: 6 },
  { key: "company", weight: 5 },
  { key: "role", weight: 4 },
  { key: "tags", weight: 3 },
  { key: "headline", weight: 2 },
  { key: "canIntroduce", weight: 1 },
];

function matchScore(n: NodeInfo, keywords: string[]) {
  let score = 0;
  const matched = new Set<string>();
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    for (const f of FIELDS) {
      const v = n[f.key];
      const hay = (Array.isArray(v) ? v.join(" | ") : (v ?? "")).toString().toLowerCase();
      if (!hay) continue;
      if (f.key === "name" && n.kind === "contact") continue; // don't match on hidden names
      if (hay.includes(kw)) {
        score += f.weight * (kw.includes(" ") ? 1.5 : 1);
        matched.add(kw);
      }
    }
  }
  return { score, matched: [...matched] };
}

export async function discover(me: User, rawQuery: string): Promise<DiscoverResponse> {
  const query = rawQuery.trim().slice(0, 120);
  const keywords = query ? await expandQuery(query) : (me.lookingFor.length ? me.lookingFor : []).map((s) => s.toLowerCase());
  const { reach, engine, ms } = await reachable(me.id, 3);
  const self = userNode(me.id);
  const ids = [...reach.keys()].filter((id) => id !== self);
  const info = await nodeDetails(ids);

  const open = await db
    .select({ id: introRequests.id, status: introRequests.status, targetUserId: introRequests.targetUserId, targetContactId: introRequests.targetContactId })
    .from(introRequests)
    .where(and(eq(introRequests.requesterId, me.id), inArray(introRequests.status, [...OPEN_STATUSES])));
  const openByTarget = new Map(open.map((o) => [o.targetUserId ? userNode(o.targetUserId) : `c:${o.targetContactId}`, { id: o.id, status: o.status }]));

  const results: DiscoverResult[] = [];
  for (const id of ids) {
    const n = info.get(id);
    const r = reach.get(id);
    if (!n || !r) continue;
    if (n.kind === "contact" && n.ownerId === me.id) continue; // your own private contact
    const m = keywords.length ? matchScore(n, keywords) : { score: 0, matched: [] as string[] };
    if (keywords.length && m.score <= 0) continue;

    const rawPaths = pathsTo(reach, id, 3);
    const paths: DiscoverPath[] = [];
    for (const p of rawPaths) {
      const connectorId = p[p.length - 2];
      if (!connectorId || connectorId === self || !isUserNode(connectorId)) continue;
      const connectorInfo = info.get(connectorId);
      if (!connectorInfo) continue;
      paths.push({
        nodes: p.map((nid) => (nid === self ? { id: self, kind: "user", name: "You", role: me.role, company: me.company, headline: null, tags: [], masked: false } : info.get(nid) ? toPublic(info.get(nid)!) : null)).filter(Boolean) as PublicNode[],
        connector: toPublic(connectorInfo),
      });
    }
    const alreadyConnected = r.depth === 1 && n.kind === "user";
    if (!alreadyConnected && paths.length === 0) continue;

    const signals: string[] = [];
    if (r.depth === 2) signals.push("2nd-degree: one intro away");
    if (r.depth === 3) signals.push("3rd-degree via a mutual");
    if (n.company) signals.push(`${n.role ? `${n.role} at ` : ""}${n.company}`);
    if (m.matched.length) signals.push(`Matches “${m.matched.slice(0, 2).join("”, “")}”`);
    const sharedTags = n.tags.filter((t) => me.lookingFor.some((l) => l.toLowerCase().includes(t) || t.includes(l.toLowerCase())));
    if (sharedTags.length) signals.push(`Fits what you're looking for: ${sharedTags.slice(0, 2).join(", ")}`);
    if (paths.length > 1) signals.push(`${paths.length} warm paths`);

    const score = m.score * 10 + (4 - r.depth) * 6 + Math.min(paths.length, 3) * 2 + sharedTags.length * 3 - (alreadyConnected ? 50 : 0);
    results.push({
      key: id,
      target: toPublic(n),
      hops: r.depth,
      paths,
      score,
      matched: m.matched,
      signals,
      alreadyConnected,
      openRequest: openByTarget.get(id) ?? null,
    });
  }
  results.sort((a, b) => b.score - a.score);

  // Members who match but aren't reachable yet — go say hi in person!
  let cold: ColdResult[] = [];
  if (keywords.length) {
    const reachedUsers = new Set(ids.filter(isUserNode).map(rawId));
    const others = await db
      .select({ id: users.id, name: users.name, company: users.company, role: users.role, headline: users.headline, tags: users.tags, lookingFor: users.lookingFor, canIntroduce: users.canIntroduce })
      .from(users)
      .where(and(ne(users.id, me.id), eq(users.onboarded, true)))
      .limit(500);
    cold = others
      .filter((o) => !reachedUsers.has(o.id))
      .map((o) => {
        const node: NodeInfo = { id: userNode(o.id), kind: "user", name: o.name, company: o.company, role: o.role, headline: o.headline, tags: o.tags, lookingFor: o.lookingFor, canIntroduce: o.canIntroduce, ownerId: null };
        return { node, ...matchScore(node, keywords) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => ({ target: toPublic(x.node), matched: x.matched }));
  }

  return { query, keywords, engine, ms, reachable: ids.length, results: results.slice(0, 25), cold };
}

/* ───────────────────────── Recommendations for the home screen ───────────────────────── */

export type Recommendation = { target: PublicNode; signals: string[]; hops: number | null; connector: PublicNode | null; score: number };

export async function recommendations(me: User, limit = 6): Promise<Recommendation[]> {
  const { reach } = await reachable(me.id, 3);
  const self = userNode(me.id);
  const others = await db
    .select({ id: users.id, name: users.name, company: users.company, role: users.role, headline: users.headline, tags: users.tags, lookingFor: users.lookingFor, canIntroduce: users.canIntroduce })
    .from(users)
    .where(and(ne(users.id, me.id), eq(users.onboarded, true)))
    .limit(500);
  const myWants = me.lookingFor.map((s) => s.toLowerCase());
  const myOffers = [...me.tags, ...me.canIntroduce, me.role ?? "", me.company ?? ""].map((s) => s.toLowerCase()).filter(Boolean);
  const overlap = (wants: string[], hay: string[]) => {
    const hits: string[] = [];
    for (const w of wants) {
      const words = w.split(/\s+/).filter((x) => x.length > 2);
      if (hay.some((h) => h.includes(w) || words.some((x) => h.includes(x)))) hits.push(w);
    }
    return hits;
  };

  const recs: Recommendation[] = [];
  for (const o of others) {
    const id = userNode(o.id);
    const r = reach.get(id);
    if (r?.depth === 1) continue; // already connected
    const theirHay = [...o.tags, ...o.canIntroduce, o.role ?? "", o.company ?? "", o.headline ?? ""].map((s) => s.toLowerCase());
    const forMe = overlap(myWants, theirHay);
    const forThem = overlap(o.lookingFor.map((s) => s.toLowerCase()), myOffers);
    const shared = o.tags.filter((t) => me.tags.includes(t));
    const relevant = forMe.length + forThem.length + shared.length > 0;
    // Recommend only for a real reason: interest overlap, or being exactly one intro away.
    if (!relevant && r?.depth !== 2) continue;
    const score = forMe.length * 5 + forThem.length * 3 + shared.length * 2 + (r ? (4 - r.depth) * 2 : 0);
    const signals: string[] = [];
    if (forMe.length) signals.push(`Matches your “${forMe[0]}”`);
    if (forThem.length) signals.push(`They're looking for “${forThem[0]}” — you can help`);
    if (shared.length) signals.push(`Both into ${shared.slice(0, 2).join(" & ")}`);
    if (!relevant) signals.push("2nd-degree — one warm intro away");
    let connector: PublicNode | null = null;
    if (r && r.depth >= 2) {
      const p = pathsTo(reach, id, 1)[0];
      const cid = p?.[p.length - 2];
      if (cid && cid !== self) {
        const ci = (await nodeDetails([cid])).get(cid);
        if (ci) connector = toPublic(ci);
      }
    }
    recs.push({
      target: { id, kind: "user", name: o.name, role: o.role, company: o.company, headline: o.headline, tags: o.tags.slice(0, 4), masked: false },
      signals,
      hops: r?.depth ?? null,
      connector,
      score,
    });
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}
