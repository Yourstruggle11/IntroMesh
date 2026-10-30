import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, contacts, emails, introRequests, notifications, paymentOrders, users, type IntroRequest, type User } from "@/db/schema";
import { maskName } from "@/lib/utils";

export async function myConnections(userId: string) {
  const other = alias(users, "other");
  const rows = await db
    .select({ id: other.id, name: other.name, headline: other.headline, role: other.role, company: other.company, tags: other.tags, since: connections.createdAt, source: connections.source })
    .from(connections)
    .innerJoin(other, or(and(eq(connections.userA, userId), eq(other.id, connections.userB)), and(eq(connections.userB, userId), eq(other.id, connections.userA))))
    .where(or(eq(connections.userA, userId), eq(connections.userB, userId)))
    .orderBy(desc(connections.createdAt));
  return rows;
}

export async function myContacts(userId: string) {
  return db.select().from(contacts).where(eq(contacts.ownerId, userId)).orderBy(desc(contacts.createdAt));
}

export type IntroRow = {
  intro: IntroRequest;
  requester: { id: string; name: string; headline: string | null; company: string | null; role: string | null };
  connector: { id: string; name: string; headline: string | null; company: string | null; role: string | null };
  target: { name: string; role: string | null; company: string | null; masked: boolean; isUser: boolean; userId: string | null };
};

async function hydrate(rows: IntroRequest[], viewerId: string): Promise<IntroRow[]> {
  if (!rows.length) return [];
  const userIds = [...new Set(rows.flatMap((r) => [r.requesterId, r.connectorId, r.targetUserId].filter(Boolean) as string[]))];
  const contactIds = [...new Set(rows.map((r) => r.targetContactId).filter(Boolean) as string[])];
  const [us, cs] = await Promise.all([
    db.select({ id: users.id, name: users.name, headline: users.headline, company: users.company, role: users.role }).from(users).where(inArray(users.id, userIds)),
    contactIds.length ? db.select({ id: contacts.id, name: contacts.name, role: contacts.role, company: contacts.company, ownerId: contacts.ownerId }).from(contacts).where(inArray(contacts.id, contactIds)) : Promise.resolve([]),
  ]);
  const U = new Map(us.map((u) => [u.id, u]));
  const C = new Map(cs.map((c) => [c.id, c]));
  return rows.map((intro) => {
    let target: IntroRow["target"];
    if (intro.targetUserId) {
      const t = U.get(intro.targetUserId);
      target = { name: t?.name ?? "Member", role: t?.role ?? null, company: t?.company ?? null, masked: false, isUser: true, userId: intro.targetUserId };
    } else {
      const c = C.get(intro.targetContactId!);
      // Reveal a private contact's name only to its owner, or to the requester once the intro email went out (they're CC'd).
      const reveal = viewerId === intro.connectorId || ["introduced", "met"].includes(intro.status);
      target = { name: c ? (reveal ? c.name : maskName(c.name)) : "Contact", role: c?.role ?? null, company: c?.company ?? null, masked: !reveal, isUser: false, userId: null };
    }
    const r = U.get(intro.requesterId)!;
    const k = U.get(intro.connectorId)!;
    return { intro, requester: r, connector: k, target };
  });
}

export async function introLists(userId: string) {
  const [incoming, outgoing, received] = await Promise.all([
    db.select().from(introRequests).where(and(eq(introRequests.connectorId, userId), sql`${introRequests.status} <> 'awaiting_payment'`)).orderBy(desc(introRequests.createdAt)).limit(100),
    db.select().from(introRequests).where(eq(introRequests.requesterId, userId)).orderBy(desc(introRequests.createdAt)).limit(100),
    db.select().from(introRequests).where(and(eq(introRequests.targetUserId, userId), inArray(introRequests.status, ["introduced", "met"]))).orderBy(desc(introRequests.createdAt)).limit(50),
  ]);
  return {
    incoming: await hydrate(incoming, userId),
    outgoing: await hydrate(outgoing, userId),
    received: await hydrate(received, userId),
  };
}

export async function introDetail(id: string, viewer: User) {
  const [intro] = await db.select().from(introRequests).where(eq(introRequests.id, id)).limit(1);
  if (!intro) return null;
  const role = intro.connectorId === viewer.id ? "connector" : intro.requesterId === viewer.id ? "requester" : intro.targetUserId === viewer.id ? "target" : null;
  if (!role) return null;
  const [row] = await hydrate([intro], viewer.id);
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.introRequestId, intro.id)).orderBy(desc(paymentOrders.createdAt)).limit(1);
  const mail = await db
    .select({ id: emails.id, kind: emails.kind, status: emails.status, error: emails.error, sentAt: emails.sentAt, createdAt: emails.createdAt })
    .from(emails)
    .where(eq(emails.relatedId, intro.id))
    .orderBy(desc(emails.createdAt));
  return { ...row, role: role as "connector" | "requester" | "target", order: order ?? null, emails: role === "connector" ? mail : mail.filter((m) => m.kind === "intro") };
}

export async function homeCounts(userId: string) {
  const [[conns], [made], [met], [earned], [awaitingMe], [toConfirm]] = await Promise.all([
    db.select({ n: count() }).from(connections).where(or(eq(connections.userA, userId), eq(connections.userB, userId))),
    db.select({ n: count() }).from(introRequests).where(and(eq(introRequests.connectorId, userId), inArray(introRequests.status, ["introduced", "met"]))),
    db.select({ n: count() }).from(introRequests).where(and(eq(introRequests.requesterId, userId), eq(introRequests.status, "met"))),
    db.select({ s: sql<string>`coalesce(sum(${introRequests.bountyUnits}), 0)::text` }).from(introRequests).where(and(eq(introRequests.connectorId, userId), eq(introRequests.bountyStatus, "paid"))),
    db.select({ n: count() }).from(introRequests).where(and(eq(introRequests.connectorId, userId), inArray(introRequests.status, ["pending", "accepted"]))),
    db
      .select({ n: count() })
      .from(introRequests)
      .where(
        or(
          and(eq(introRequests.requesterId, userId), eq(introRequests.status, "introduced"), isNull(introRequests.requesterConfirmedAt)),
          and(eq(introRequests.targetUserId, userId), eq(introRequests.status, "introduced"), isNull(introRequests.targetConfirmedAt)),
        ),
      ),
  ]);
  return {
    connections: Number(conns?.n ?? 0),
    introsMade: Number(made?.n ?? 0),
    meetings: Number(met?.n ?? 0),
    earnedUnits: earned?.s ?? "0",
    awaitingMe: Number(awaitingMe?.n ?? 0),
    toConfirm: Number(toConfirm?.n ?? 0),
  };
}

export async function recentNotifications(userId: string, limit = 8) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}
