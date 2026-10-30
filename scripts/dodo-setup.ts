import { existsSync, readFileSync, writeFileSync } from "fs";
import DodoPayments from "dodopayments";
import { loadEnv } from "./_env";
import { PLANS } from "../src/lib/plans";

loadEnv();

/** Set KEY=value in .env.local, replacing an existing line (even an empty placeholder) or appending. */
function setEnvValue(key: string, value: string) {
  const file = ".env.local";
  const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  const next = re.test(cur) ? cur.replace(re, `${key}=${value}`) : `${cur}${cur.endsWith("\n") || !cur ? "" : "\n"}${key}=${value}\n`;
  writeFileSync(file, next);
  process.env[key] = value;
}

const WEBHOOK_EVENTS = [
  "subscription.active",
  "subscription.renewed",
  "subscription.updated",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.past_due",
  "subscription.paused",
  "subscription.failed",
  "subscription.cancelled",
  "subscription.expired",
] as const;

async function main() {
  if (!process.env.DODO_API_KEY) throw new Error("Set DODO_API_KEY in .env.local first.");
  const client = new DodoPayments({ bearerToken: process.env.DODO_API_KEY, environment: process.env.DODO_ENV === "live_mode" ? "live_mode" : "test_mode" });
  console.log(`Dodo environment: ${process.env.DODO_ENV === "live_mode" ? "LIVE" : "test"}`);

  // 1) Products
  for (const id of ["pro", "team"] as const) {
    const envKey = id === "pro" ? "DODO_PRODUCT_PRO" : "DODO_PRODUCT_TEAM";
    if (process.env[envKey]) {
      console.log(`• ${envKey} already set (${process.env[envKey]}), skipping.`);
      continue;
    }
    const plan = PLANS[id];
    const product = await client.products.create({
      name: `IntroMesh ${plan.name}`,
      description: `${plan.tagline} ${plan.features.join(" · ")}`,
      tax_category: "saas",
      price: {
        type: "recurring_price",
        currency: "USD",
        price: plan.priceCents,
        discount: 0,
        purchasing_power_parity: false,
        payment_frequency_count: 1,
        payment_frequency_interval: "Month",
        subscription_period_count: 1,
        subscription_period_interval: "Year",
      },
    });
    setEnvValue(envKey, product.product_id);
    console.log(`✓ Created product IntroMesh ${plan.name}: ${product.product_id}`);
  }

  // 2) Webhook → our signed endpoint
  const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(appUrl)) {
    console.log("• APP_URL is not an https URL, so the webhook was not registered. Set APP_URL to your Vercel URL and re-run.");
    return;
  }
  const url = `${appUrl}/api/webhooks/dodo`;
  let webhookId: string | null = null;
  for await (const w of client.webhooks.list()) {
    if (w.url === url) {
      webhookId = w.id;
      break;
    }
  }
  if (webhookId) {
    console.log(`• Webhook already registered for ${url} (${webhookId}).`);
  } else {
    const w = await client.webhooks.create({ url, description: "IntroMesh subscriptions", filter_types: [...WEBHOOK_EVENTS] });
    webhookId = w.id;
    console.log(`✓ Registered webhook ${url} (${webhookId})`);
  }
  if (!process.env.DODO_WEBHOOK_SECRET) {
    const { secret } = await client.webhooks.retrieveSecret(webhookId);
    setEnvValue("DODO_WEBHOOK_SECRET", secret);
    console.log("✓ Webhook signing secret saved to .env.local (not printed).");
  } else {
    console.log("• DODO_WEBHOOK_SECRET already set, left unchanged.");
  }
  console.log("\nNext: copy DODO_PRODUCT_PRO, DODO_PRODUCT_TEAM and DODO_WEBHOOK_SECRET into Vercel env vars, then redeploy.");
}

main().catch((e) => {
  console.error("Dodo setup failed:", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
