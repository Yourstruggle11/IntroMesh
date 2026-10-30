"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { introRequests, paymentOrders } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth";
import { cryptoNetwork, isChainKey, defaultChain } from "@/lib/crypto/chains";
import { createOrder } from "@/lib/crypto/payments";
import { createDodoCheckout } from "@/lib/dodo";
import { getOrderForUser, submitTxHash } from "@/lib/orders";
import { PLANS, isPlanId } from "@/lib/plans";

export async function startDodoCheckoutAction(plan: string): Promise<{ error?: string; url?: string }> {
  const me = await requireOnboardedUser();
  if (!isPlanId(plan) || plan === "free") return { error: "Choose a paid plan." };
  try {
    const url = await createDodoCheckout(me, plan);
    return { url };
  } catch (err) {
    console.error("[dodo] checkout failed", err);
    return { error: (err as Error).message || "Couldn't start card checkout." };
  }
}

export async function startCryptoCheckoutAction(plan: string, chain: string): Promise<{ error?: string }> {
  const me = await requireOnboardedUser();
  if (!isPlanId(plan) || plan === "free") return { error: "Choose a paid plan." };
  let orderId: string;
  try {
    const order = await createOrder({ userId: me.id, purpose: "plan", plan, usdCents: PLANS[plan].priceCents, chain: isChainKey(chain) ? chain : defaultChain() });
    orderId = order.id;
  } catch (err) {
    return { error: (err as Error).message || "Couldn't start USDC checkout." };
  }
  redirect(`/pay/${orderId}`);
}

/** Issue a new payment link for an unfunded bounty whose previous order expired. */
export async function renewBountyOrderAction(introId: string): Promise<{ error?: string }> {
  const me = await requireOnboardedUser();
  const [intro] = await db
    .select()
    .from(introRequests)
    .where(and(eq(introRequests.id, introId), eq(introRequests.requesterId, me.id), eq(introRequests.bountyStatus, "awaiting_payment")))
    .limit(1);
  if (!intro || !intro.bountyUnits || !isChainKey(intro.bountyChain)) return { error: "This bounty can't be funded anymore." };
  if (intro.bountyNetwork && intro.bountyNetwork !== cryptoNetwork()) return { error: `This bounty was created on ${intro.bountyNetwork}; the app is now on ${cryptoNetwork()}. Cancel it and create a new request.` };
  let orderId: string;
  try {
    await db.update(paymentOrders).set({ status: "expired" }).where(and(eq(paymentOrders.introRequestId, intro.id), eq(paymentOrders.status, "pending")));
    const order = await createOrder({ userId: me.id, purpose: "bounty", usdCents: Number(intro.bountyUnits / BigInt(10_000)), chain: intro.bountyChain, introRequestId: intro.id });
    orderId = order.id;
  } catch (err) {
    return { error: (err as Error).message };
  }
  redirect(`/pay/${orderId}`);
}

export async function submitTxHashAction(orderId: string, hash: string): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireOnboardedUser();
  const order = await getOrderForUser(orderId, me.id);
  if (!order) return { error: "Order not found." };
  try {
    const r = await submitTxHash(order, hash);
    if (r.error) return { error: r.error };
    return { ok: r.order.status === "paid" };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
