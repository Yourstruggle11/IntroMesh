import "server-only";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { contacts, introRequests, subscriptions, users, type User } from "@/db/schema";
import { PLANS, type Plan, type PlanId, isPlanId } from "@/lib/plans";
import { logEvent, notify } from "@/lib/activity";

export function effectivePlanId(user: Pick<User, "plan" | "planPaidThrough">): PlanId {
  if (!isPlanId(user.plan) || user.plan === "free") return "free";
  if (!user.planPaidThrough || user.planPaidThrough.getTime() < Date.now()) return "free";
  return user.plan;
}

export function effectivePlan(user: Pick<User, "plan" | "planPaidThrough">): Plan {
  return PLANS[effectivePlanId(user)];
}

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function usage(user: User) {
  const plan = effectivePlan(user);
  const [[req], [ct]] = await Promise.all([
    db
      .select({ n: count() })
      .from(introRequests)
      .where(and(eq(introRequests.requesterId, user.id), gte(introRequests.createdAt, monthStart()), ne(introRequests.status, "cancelled"))),
    db.select({ n: count() }).from(contacts).where(eq(contacts.ownerId, user.id)),
  ]);
  const requestsUsed = Number(req?.n ?? 0);
  const contactsUsed = Number(ct?.n ?? 0);
  return {
    plan,
    requestsUsed,
    requestsLimit: plan.requestsPerMonth,
    requestsLeft: plan.requestsPerMonth === null ? null : Math.max(0, plan.requestsPerMonth - requestsUsed),
    contactsUsed,
    contactsLimit: plan.maxContacts,
  };
}

/**
 * Grant (or extend) a paid plan. Called only from verified payment events:
 * a signed Dodo webhook or an on-chain payment we verified ourselves.
 */
export async function grantPlan(opts: { userId: string; plan: PlanId; paidThrough: Date; provider: "dodo" | "crypto"; externalId: string; status?: string }) {
  const { userId, plan, paidThrough, provider, externalId } = opts;
  await db
    .insert(subscriptions)
    .values({ userId, provider, plan, status: opts.status ?? "active", externalId, paidThrough })
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.externalId],
      set: { plan, status: opts.status ?? "active", paidThrough, updatedAt: new Date() },
    });

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  // Never shorten an existing longer entitlement of the same or higher plan.
  const keepCurrent = u.planPaidThrough && u.planPaidThrough > paidThrough && effectivePlanId(u) !== "free" && rank(u.plan as PlanId) >= rank(plan);
  if (!keepCurrent) {
    await db.update(users).set({ plan, planPaidThrough: paidThrough, planSource: provider, updatedAt: new Date() }).where(eq(users.id, userId));
  }
  await logEvent("plan.activated", userId, userId, { plan, provider, paidThrough: paidThrough.toISOString() });
  await notify(userId, { type: "plan", title: `${PLANS[plan].name} plan active`, body: `Paid through ${paidThrough.toDateString()} via ${provider === "dodo" ? "card" : "USDC"}.`, link: "/billing" });
}

export async function endPlanFromProvider(opts: { provider: "dodo" | "crypto"; externalId: string; status: string; paidThrough?: Date | null }) {
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.provider, opts.provider), eq(subscriptions.externalId, opts.externalId))).limit(1);
  if (!sub) return;
  await db.update(subscriptions).set({ status: opts.status, paidThrough: opts.paidThrough ?? sub.paidThrough, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
  if (opts.status === "expired" || opts.status === "cancelled") {
    const until = opts.paidThrough ?? sub.paidThrough ?? new Date();
    const [u] = await db.select().from(users).where(eq(users.id, sub.userId)).limit(1);
    if (u && u.planSource === opts.provider && u.plan === sub.plan) {
      await db.update(users).set({ planPaidThrough: until, updatedAt: new Date() }).where(eq(users.id, sub.userId));
    }
  }
}

function rank(p: PlanId) {
  return p === "team" ? 2 : p === "pro" ? 1 : 0;
}
