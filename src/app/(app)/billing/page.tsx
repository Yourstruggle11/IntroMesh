import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, CreditCard, Receipt, Wallet } from "lucide-react";
import { db } from "@/db";
import { paymentOrders, subscriptions } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { PlanActions, CheckoutReturnWatcher } from "@/components/billing/plan-actions";
import { Badge, Card } from "@/components/ui/primitives";
import { requireOnboardedUser } from "@/lib/auth";
import { effectivePlanId } from "@/lib/billing";
import { CHAINS, defaultChain, enabledChains, formatUnits6, isChainKey, txUrl } from "@/lib/crypto/chains";
import { walletConfigured } from "@/lib/crypto/payments";
import { dodoConfigured } from "@/lib/dodo";
import { PLANS, formatUsd } from "@/lib/plans";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans & billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; paid?: string }> }) {
  const { checkout, paid } = await searchParams;
  const user = await requireOnboardedUser("/billing");
  const current = effectivePlanId(user);
  const [subs, orders] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.createdAt)).limit(10),
    db.select().from(paymentOrders).where(eq(paymentOrders.userId, user.id)).orderBy(desc(paymentOrders.createdAt)).limit(10),
  ]);
  const chains = enabledChains().map((k) => ({ key: k, label: CHAINS[k].label }));

  return (
    <>
      <PageHeader eyebrow="Plans & billing" title="Choose how you grow" description="Subscribe by card through Dodo Payments, or prepay 30 days in USDC from Cake Wallet. Access is granted only after a verified payment." />
      {checkout === "success" && <CheckoutReturnWatcher currentPlan={current} />}
      {paid && (
        <Card className="mb-6 border-success/25 bg-success/[0.06] p-4 text-sm text-success">Payment verified — your plan is active.</Card>
      )}

      <Card className="mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <BadgeCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="text-xl font-semibold">{PLANS[current].name}</p>
          </div>
        </div>
        <div className="text-sm text-muted sm:text-right">
          {current === "free" ? (
            "Free forever"
          ) : (
            <>
              Paid through <b className="text-fg">{user.planPaidThrough?.toDateString()}</b>
              <br />
              via {user.planSource === "dodo" ? "card (Dodo Payments)" : "USDC"}
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <Card key={p.id} className={cn("relative flex flex-col p-6", p.highlight && "ring-gradient bg-brand/[0.04]", current === p.id && "border-brand/40")}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              {current === p.id ? <Badge tone="brand">Current</Badge> : p.highlight ? <Badge tone="violet">Popular</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted">{p.tagline}</p>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">{p.priceCents ? formatUsd(p.priceCents) : "$0"}</span>
              <span className="text-sm text-muted">/ month</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-fg/85">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {p.id === "free" ? (
                <p className="text-center text-xs text-subtle">Always available</p>
              ) : (
                <PlanActions plan={p.id} isCurrent={current === p.id} dodoReady={dodoConfigured()} cryptoReady={walletConfigured()} chains={chains} defaultChain={defaultChain()} />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <div className="flex items-center gap-2 p-5 pb-3 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-brand" /> Payment history
        </div>
        {subs.length === 0 && orders.filter((o) => o.status === "paid").length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                {s.provider === "dodo" ? <CreditCard className="h-4 w-4 text-muted" /> : <Wallet className="h-4 w-4 text-gold" />}
                <span className="flex-1">
                  {PLANS[s.plan as keyof typeof PLANS]?.name ?? s.plan} · {s.provider === "dodo" ? "Card subscription" : "USDC prepaid"}
                </span>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
                <span className="hidden text-xs text-subtle sm:inline">{timeAgo(s.updatedAt)}</span>
              </li>
            ))}
            {orders
              .filter((o) => o.status === "paid" && o.purpose === "bounty")
              .map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Wallet className="h-4 w-4 text-gold" />
                  <span className="flex-1">Intro bounty · {formatUnits6(o.amountUnits)} USDC</span>
                  {o.txHash && isChainKey(o.chain) && (
                    <a href={txUrl(o.chain, o.txHash, o.network)} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                      tx
                    </a>
                  )}
                  <span className="hidden text-xs text-subtle sm:inline">{timeAgo(o.paidAt)}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </>
  );
}
