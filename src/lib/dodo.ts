import "server-only";
import DodoPayments from "dodopayments";
import { Webhook } from "standardwebhooks";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, webhookEvents, type User } from "@/db/schema";
import { endPlanFromProvider, grantPlan } from "@/lib/billing";
import { isPlanId, type PlanId } from "@/lib/plans";
import { absoluteUrl } from "@/lib/utils";

export function dodoProduct(plan: PlanId) {
  if (plan === "pro") return process.env.DODO_PRODUCT_PRO || null;
  if (plan === "team") return process.env.DODO_PRODUCT_TEAM || null;
  return null;
}

export function dodoConfigured() {
  return Boolean(process.env.DODO_API_KEY && dodoProduct("pro") && dodoProduct("team"));
}

export function dodoClient() {
  return new DodoPayments({
    bearerToken: process.env.DODO_API_KEY,
    environment: process.env.DODO_ENV === "live_mode" ? "live_mode" : "test_mode",
  });
}

/** Creates a hosted Dodo checkout for a subscription plan and returns its URL. */
export async function createDodoCheckout(user: User, plan: PlanId) {
  const productId = dodoProduct(plan);
  if (!process.env.DODO_API_KEY || !productId) throw new Error("Card payments aren't configured yet.");
  const session = await dodoClient().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email: user.email, name: user.name },
    return_url: absoluteUrl(`/billing?checkout=success&plan=${plan}`),
    metadata: { userId: user.id, plan },
  });
  if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL.");
  return session.checkout_url;
}

type DodoEvent = {
  type: string;
  timestamp?: string;
  data: {
    subscription_id?: string;
    product_id?: string;
    status?: string;
    next_billing_date?: string;
    previous_billing_date?: string;
    metadata?: Record<string, string>;
    customer?: { email?: string };
  };
};

/**
 * Verify (Standard Webhooks signature) and process a Dodo webhook.
 * Entitlements change ONLY here — never from the checkout redirect.
 */
export async function handleDodoWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) throw new WebhookError(500, "DODO_WEBHOOK_SECRET is not configured");
  const h = {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
  };
  try {
    new Webhook(secret).verify(rawBody, h);
  } catch {
    throw new WebhookError(401, "Invalid webhook signature");
  }
  const event = JSON.parse(rawBody) as DodoEvent;
  const eventId = `dodo:${h["webhook-id"]}`;

  // Idempotency: process each webhook id once.
  const inserted = await db.insert(webhookEvents).values({ id: eventId, provider: "dodo", type: event.type, payload: event }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (!inserted.length) {
    const [prev] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId)).limit(1);
    if (prev?.processedAt) return { duplicate: true };
  }

  try {
    await processEvent(event);
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, eventId));
  } catch (err) {
    await db.update(webhookEvents).set({ error: (err as Error).message.slice(0, 500) }).where(eq(webhookEvents.id, eventId));
    throw err;
  }
  return { duplicate: false };
}

async function resolveUser(event: DodoEvent): Promise<string | null> {
  const metaUser = event.data.metadata?.userId;
  if (metaUser) return metaUser;
  const email = event.data.customer?.email?.toLowerCase();
  if (!email) return null;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

function planFromEvent(event: DodoEvent): PlanId | null {
  const meta = event.data.metadata?.plan;
  if (isPlanId(meta)) return meta;
  if (event.data.product_id && event.data.product_id === process.env.DODO_PRODUCT_PRO) return "pro";
  if (event.data.product_id && event.data.product_id === process.env.DODO_PRODUCT_TEAM) return "team";
  return null;
}

async function processEvent(event: DodoEvent) {
  const subId = event.data.subscription_id;
  if (!event.type.startsWith("subscription.") || !subId) return; // payments etc. are informational
  const userId = await resolveUser(event);
  const plan = planFromEvent(event);
  if (!userId || !plan) {
    console.warn("[dodo] could not map event to user/plan", event.type, subId);
    return;
  }
  const next = event.data.next_billing_date ? new Date(event.data.next_billing_date) : new Date(Date.now() + 31 * 86400_000);
  switch (event.type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed":
    case "subscription.updated":
      if (event.data.status && !["active", "trialing"].includes(event.data.status)) {
        await endPlanFromProvider({ provider: "dodo", externalId: subId, status: event.data.status });
        return;
      }
      await grantPlan({ userId, plan, paidThrough: next, provider: "dodo", externalId: subId });
      return;
    case "subscription.on_hold":
    case "subscription.past_due":
    case "subscription.paused":
    case "subscription.failed":
      await endPlanFromProvider({ provider: "dodo", externalId: subId, status: event.type.split(".")[1] });
      return;
    case "subscription.cancelled":
    case "subscription.expired": {
      // Access continues until the end of the already-paid period.
      const until = event.data.previous_billing_date && event.type === "subscription.expired" ? new Date() : next;
      await endPlanFromProvider({ provider: "dodo", externalId: subId, status: event.type.split(".")[1], paidThrough: until });
      return;
    }
  }
}

export class WebhookError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
