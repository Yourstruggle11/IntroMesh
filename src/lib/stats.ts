import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, events, introRequests, users } from "@/db/schema";
import { firstName } from "@/lib/utils";

export type LiveStats = {
  totals: { members: number; connections: number; requested: number; introduced: number; met: number; paidUnits: string; heldUnits: string };
  leaders: { id: string; name: string; company: string | null; intros: number; met: number; earnedUnits: string }[];
  graph: { nodes: { id: string; label: string; size: number }[]; links: { source: string; target: string }[] };
  feed: { id: string; type: string; text: string; at: string }[];
};

export async function liveStats(): Promise<LiveStats> {
  const [[m], [c], [req], [intro], [met], [paid], [held]] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.onboarded, true)),
    db.select({ n: count() }).from(connections),
    db.select({ n: count() }).from(introRequests),
    db.select({ n: count() }).from(introRequests).where(inArray(introRequests.status, ["introduced", "met"])),
    db.select({ n: count() }).from(introRequests).where(eq(introRequests.status, "met")),
    db.select({ s: sql<string>`coalesce(sum(${introRequests.bountyUnits}), 0)::text` }).from(introRequests).where(eq(introRequests.bountyStatus, "paid")),
    db.select({ s: sql<string>`coalesce(sum(${introRequests.bountyUnits}), 0)::text` }).from(introRequests).where(eq(introRequests.bountyStatus, "held")),
  ]);

  const leaderRows = await db
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
    .limit(10);

  const members = await db
    .select({ id: users.id, name: users.name, show: users.showOnLeaderboard })
    .from(users)
    .where(eq(users.onboarded, true))
    .limit(400);
  const memberIds = new Set(members.map((x) => x.id));
  const conns = await db.select({ a: connections.userA, b: connections.userB }).from(connections).limit(2000);
  const degree = new Map<string, number>();
  for (const e of conns) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }

  const feedRows = await db
    .select({ id: events.id, type: events.type, actorId: events.actorId, subjectId: events.subjectId, data: events.data, at: events.createdAt })
    .from(events)
    .where(inArray(events.type, ["connection.created", "intro.introduced", "intro.met", "bounty.paid", "user.onboarded"]))
    .orderBy(desc(events.createdAt))
    .limit(14);
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
    totals: {
      members: Number(m?.n ?? 0),
      connections: Number(c?.n ?? 0),
      requested: Number(req?.n ?? 0),
      introduced: Number(intro?.n ?? 0),
      met: Number(met?.n ?? 0),
      paidUnits: paid?.s ?? "0",
      heldUnits: held?.s ?? "0",
    },
    leaders: leaderRows.map((l) => ({ id: l.id, name: l.name, company: l.company, intros: Number(l.intros), met: Number(l.met), earnedUnits: l.earned })),
    graph: {
      nodes: members.map((x) => ({ id: x.id, label: x.show ? firstName(x.name) : "", size: degree.get(x.id) ?? 0 })),
      links: conns.filter((e) => memberIds.has(e.a) && memberIds.has(e.b)).map((e) => ({ source: e.a, target: e.b })),
    },
    feed,
  };
}
