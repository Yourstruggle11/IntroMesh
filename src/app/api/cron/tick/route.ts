import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { introRequests, paymentOrders } from "@/db/schema";
import { expireDue, payoutBounty } from "@/lib/intros";
import { refreshOrder } from "@/lib/orders";

export const maxDuration = 60;

/** Housekeeping: expiries, refunds, payout retries, late payment detection. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expired = await expireDue();
  const payouts = await db.select({ id: introRequests.id }).from(introRequests).where(and(eq(introRequests.status, "met"), eq(introRequests.bountyStatus, "held"))).limit(20);
  for (const p of payouts) await payoutBounty(p.id);

  // Catch payments that landed while nobody had the pay page open.
  const pending = await db.select().from(paymentOrders).where(and(eq(paymentOrders.status, "pending"), lt(paymentOrders.createdAt, new Date(Date.now() - 60_000)))).limit(20);
  let detected = 0;
  for (const o of pending) {
    try {
      const r = await refreshOrder(o);
      if (r.status === "paid") detected++;
    } catch {
      /* RPC hiccup */
    }
  }
  return NextResponse.json({ ok: true, expired, payoutsTried: payouts.length, paymentsDetected: detected });
}
