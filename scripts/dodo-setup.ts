import { appendFileSync } from "fs";
import DodoPayments from "dodopayments";
import { loadEnv } from "./_env";
import { PLANS } from "../src/lib/plans";

loadEnv();

async function main() {
  if (!process.env.DODO_API_KEY) throw new Error("Set DODO_API_KEY in .env.local first.");
  const client = new DodoPayments({ bearerToken: process.env.DODO_API_KEY, environment: process.env.DODO_ENV === "live_mode" ? "live_mode" : "test_mode" });
  const lines: string[] = [];
  for (const id of ["pro", "team"] as const) {
    const envKey = id === "pro" ? "DODO_PRODUCT_PRO" : "DODO_PRODUCT_TEAM";
    if (process.env[envKey]) {
      console.log(`${envKey} already set (${process.env[envKey]}), skipping.`);
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
    console.log(`✓ Created ${plan.name}: ${product.product_id}`);
    lines.push(`${envKey}=${product.product_id}`);
  }
  if (lines.length) {
    appendFileSync(".env.local", `\n# Dodo products\n${lines.join("\n")}\n`);
    console.log("✓ Product IDs appended to .env.local — also add them to Vercel env vars.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
