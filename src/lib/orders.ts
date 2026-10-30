import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders, subscriptions, users, type PaymentOrder } from "@/db/schema";
import { grantPlan } from "@/lib/billing";
import { checkOrder, verifyTxHash } from "@/lib/crypto/payments";
import { markBountyHeld } from "@/lib/intros";
import { CRYPTO_TERM_DAYS, isPlanId } from "@/lib/plans";

export async function getOrderForUser(orderId: string, userId: string) {
  const [o] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, userId))).limit(1);
  return o ?? null;
}

/** Idempotent: safe to call repeatedly for a paid order. */
export async function fulfillOrder(order: PaymentOrder) {
  if (order.status !== "paid") return;
  if (order.purpose === "bounty" && order.introRequestId) {
    await markBountyHeld(order.introRequestId, order.payerAddress ?? "");
    return;
  }
  if (order.purpose === "plan" && isPlanId(order.plan) && order.plan !== "free") {
    const [already] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.provider, "crypto"), eq(subscriptions.externalId, order.id))).limit(1);
    if (already) return;
    const [u] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
    const startFrom = u && u.plan === order.plan && u.planPaidThrough && u.planPaidThrough > new Date() ? u.planPaidThrough : new Date();
    const paidThrough = new Date(startFrom.getTime() + CRYPTO_TERM_DAYS * 86400_000);
    await grantPlan({ userId: order.userId, plan: order.plan, paidThrough, provider: "crypto", externalId: order.id });
  }
}

export async function refreshOrder(order: PaymentOrder) {
  const { order: o } = await checkOrder(order);
  await fulfillOrder(o);
  return o;
}

export async function submitTxHash(order: PaymentOrder, hash: string) {
  const r = await verifyTxHash(order, hash);
  await fulfillOrder(r.order);
  return r;
}
