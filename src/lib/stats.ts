import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, events, introRequests, users } from "@/db/schema";
import { firstName } from "@/lib/utils";

export type LiveTotals = { members: number; connections: number; requested: number; introduced: number; met: number; paidUnits: string; heldUnits: string };

export type LiveStats = {
  totals: LiveTotals;
  leaders: { id: string; name: string; company: string | null; intros: number; met: number; earnedUnits: string }[];
  graph: { nodes: { id: string; label: string; size: number; joinedAt: string }[]; links: { source: string; target: string; at: string }[] };
  feed: { id: string; type: string; text: string; at: string }[];
};

export const EMPTY_LIVE_STATS: LiveStats = {
  totals: { members: 0, connections: 0, requested: 0, introduced: 0, met: 0, paidUnits: "0", heldUnits: "0" },
  leaders: [],
  graph: { nodes: [], links: [] },
  feed: [],
};

/* ───────────── Shared cache: the landing page, /live and every polling screen read the same numbers ───────────── */

type Entry<T> = { at: number; value?: T; inflight?: Promise<T> };
const cache = globalThis as unknown as { __liveTotals?: Entry<LiveTotals>; __liveStats?: Entry<LiveStats> };

/** Fresh value if younger than `ttl`; otherwise the last good value while one refresh runs in the background. */
function cached<T>(entry: Entry<T>, ttl: number, compute: () => Promise<T>): Promise<T> {
  if (entry.value !== undefined && Date.now() - entry.at < ttl) return Promise.resolve(entry.value);
  if (!entry.inflight) {
    entry.inflight = compute()
      .then((v) => {
        entry.value = v;
        entry.at = Date.now();
        return v;
      })
      .finally(() => {
        entry.inflight = undefined;
      });
    entry.inflight.catch((err) => console.error("[stats]", (err as Error).message));
  }
  return entry.value !== undefined ? Promise.resolve(entry.value) : entry.inflight;
}

/** Resolve within `ms`, or reject, so a slow database never holds a page open. */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
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

/* ───────────── Queries ───────────── */

/** All headline numbers in one round trip. */
async function queryTotals(): Promise<LiveTotals> {
  const [r] = await db
    .select({
      members: sql<number>`(select count(*) from ${users} where ${users.onboarded} = true)::int`,
      connections: sql<number>`(select count(*) from ${connections})::int`,
      requested: sql<number>`(select count(*) from ${introRequests})::int`,
      introduced: sql<number>`(select count(*) from ${introRequests} where ${introRequests.status} in ('introduced', 'met'))::int`,
      met: sql<number>`(select count(*) from ${introRequests} where ${introRequests.status} = 'met')::int`,
      paidUnits: sql<string>`(select coalesce(sum(${introRequests.bountyUnits}), 0)::text from ${introRequests} where ${introRequests.bountyStatus} = 'paid')`,
      heldUnits: sql<string>`(select coalesce(sum(${introRequests.bountyUnits}), 0)::text from ${introRequests} where ${introRequests.bountyStatus} = 'held')`,
    })
    .from(sql`(select 1) as one`);
  return {
    members: Number(r?.members ?? 0),
    connections: Number(r?.connections ?? 0),
    requested: Number(r?.requested ?? 0),
    introduced: Number(r?.introduced ?? 0),
    met: Number(r?.met ?? 0),
    paidUnits: r?.paidUnits ?? "0",
    heldUnits: r?.heldUnits ?? "0",
  };
}

async function queryLiveStats(): Promise<LiveStats> {
  const [totals, leaderRows, members, conns, feedRows] = await Promise.all([
    queryTotals(),
    db
      .select({
        id: users.id,
        name: users.name,
        company: users.company,
        intros: sql<number>`count(*) filter (where ${introRequests.status} in ('introduced','met'))::int`,
        met: sql<number>`count(*) filter (where ${introRequests.status} = 'met')::int`,
        earned: sql<string>`coalesce(sum(${introRequests.bountyUnits}) filter (where ${introRequests.bountyStatus} = 'paid'), 0)::text`,
      })
      .from(introRequests)
      .innerJoin(users, eq(users.id, introRequests.connectorId))
      .where(and(eq(users.showOnLeaderboard, true), inArray(introRequests.status, ["introduced", "met"])))
      .groupBy(users.id, users.name, users.company)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db.select({ id: users.id, name: users.name, show: users.showOnLeaderboard, at: users.createdAt }).from(users).where(eq(users.onboarded, true)).limit(400),
    db.select({ a: connections.userA, b: connections.userB, at: connections.createdAt }).from(connections).limit(2000),
    db
      .select({ id: events.id, type: events.type, actorId: events.actorId, data: events.data, at: events.createdAt })
      .from(events)
      .where(inArray(events.type, ["connection.created", "intro.introduced", "intro.met", "bounty.paid", "user.onboarded"]))
      .orderBy(desc(events.createdAt))
      .limit(14),
  ]);

  const memberIds = new Set(members.map((x) => x.id));
  const degree = new Map<string, number>();
  for (const e of conns) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  // Members who opted out of the leaderboard stay anonymous everywhere on the event screen.
  const nameOf = new Map(members.map((x) => [x.id, x.show ? firstName(x.name) : "A member"]));

  const feed = feedRows.map((e) => {
    const actor = (e.actorId && nameOf.get(e.actorId)) || "Someone";
    let text = "";
    switch (e.type) {
      case "connection.created":
        text = `${actor} connected with ${nameOf.get(String(e.data.otherId)) ?? "a builder"}`;
        break;
      case "intro.introduced":
        text = `${actor} made a warm intro`;
        break;
      case "intro.met":
        text = `An intro turned into a meeting 🤝`;
        break;
      case "bounty.paid":
        text = `${nameOf.get(String(e.data.connectorId)) ?? "A connector"} earned a USDC bounty 💸`;
        break;
      case "user.onboarded":
        text = `${actor} joined the mesh`;
        break;
    }
    return { id: e.id, type: e.type, text, at: e.at.toISOString() };
  });

  return {
    totals,
    leaders: leaderRows.map((l) => ({ id: l.id, name: l.name, company: l.company, intros: Number(l.intros), met: Number(l.met), earnedUnits: l.earned })),
    graph: {
      nodes: members.map((x) => ({ id: x.id, label: x.show ? firstName(x.name) : "", size: degree.get(x.id) ?? 0, joinedAt: x.at.toISOString() })),
      links: conns.filter((e) => memberIds.has(e.a) && memberIds.has(e.b)).map((e) => ({ source: e.a, target: e.b, at: e.at.toISOString() })),
    },
    feed,
  };
}

/* ───────────── Public API ───────────── */

/** Headline numbers for the landing page (one query, cached for 15s). */
export function liveTotals(): Promise<LiveTotals> {
  return cached((cache.__liveTotals ??= { at: 0 }), 15_000, queryTotals);
}

/** Everything the /live board shows (cached for 8s, shared by every screen polling it). */
export function liveStats(): Promise<LiveStats> {
  return cached((cache.__liveStats ??= { at: 0 }), 8_000, async () => {
    const s = await queryLiveStats();
    cache.__liveTotals = { at: Date.now(), value: s.totals };
    return s;
  });
}
