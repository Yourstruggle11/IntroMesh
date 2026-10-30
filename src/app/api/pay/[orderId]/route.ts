import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrderForUser, refreshOrder } from "@/lib/orders";

const lastCheck = new Map<string, number>();

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let order = await getOrderForUser(orderId, user.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Throttle chain reads per order (public RPCs are rate limited).
  const now = Date.now();
  if (order.status === "pending" && now - (lastCheck.get(orderId) ?? 0) > 3500) {
    lastCheck.set(orderId, now);
    try {
      order = await refreshOrder(order);
    } catch (err) {
      console.warn("[pay] chain check failed", (err as Error).message);
    }
  }
  return NextResponse.json({
    status: order.status,
    txHash: order.txHash,
    purpose: order.purpose,
    introRequestId: order.introRequestId,
    plan: order.plan,
  });
}
