"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { startCryptoCheckoutAction, startDodoCheckoutAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/client";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function PlanActions({ plan, isCurrent, dodoReady, cryptoReady, chains, defaultChain }: { plan: string; isCurrent: boolean; dodoReady: boolean; cryptoReady: boolean; chains: { key: string; label: string }[]; defaultChain: string }) {
  const [cardPending, startCard] = useTransition();
  const [cryptoPending, startCrypto] = useTransition();
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState(defaultChain);
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        loading={cardPending}
        disabled={!dodoReady}
        onClick={() =>
          startCard(async () => {
            const r = await startDodoCheckoutAction(plan);
            if (r.error || !r.url) return void toast.error(r.error ?? "Checkout unavailable");
            window.location.href = r.url;
          })
        }
      >
        <CreditCard className="h-4 w-4" /> {isCurrent ? "Renew" : "Subscribe"} with card
      </Button>
      <Button variant="secondary" className="w-full" disabled={!cryptoReady} onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4 text-gold" /> Pay 30 days in USDC
      </Button>
      {(!dodoReady || !cryptoReady) && <p className="text-center text-[11px] text-subtle">{!dodoReady && !cryptoReady ? "Payments are being configured" : !dodoReady ? "Card payments coming online shortly" : "USDC payments coming online shortly"}</p>}
      <Dialog open={open} onOpenChange={setOpen} title="Pay with USDC" description="Prepay 30 days from Cake Wallet or any EVM wallet. No auto-renewal.">
        <p className="mb-2 text-sm font-medium">Network</p>
        <div className="grid grid-cols-3 gap-2">
          {chains.map((c) => (
            <button key={c.key} onClick={() => setChain(c.key)} className={cn("rounded-xl border px-3 py-3 text-sm transition", chain === c.key ? "border-brand/50 bg-brand/10 text-brand" : "border-line text-muted hover:text-fg")}>
              {c.label}
            </button>
          ))}
        </div>
        <Button
          size="lg"
          className="mt-5 w-full"
          loading={cryptoPending}
          onClick={() =>
            startCrypto(async () => {
              const r = await startCryptoCheckoutAction(plan, chain);
              if (r?.error) toast.error(r.error);
            })
          }
        >
          Continue to payment
        </Button>
      </Dialog>
    </div>
  );
}

/** After returning from Dodo checkout, poll until the signed webhook activates the plan. */
export function CheckoutReturnWatcher({ currentPlan }: { currentPlan: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const active = currentPlan !== "free";
  useEffect(() => {
    if (active || tries > 12) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [active, tries, router]);
  if (active) return <Card className="mb-6 border-success/25 bg-success/[0.06] p-4 text-sm text-success">Payment confirmed by Dodo — your plan is active. 🎉</Card>;
  return (
    <Card className="mb-6 flex items-center gap-3 p-4 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-brand" />
      {tries > 12 ? "Still waiting for Dodo to confirm the payment. This page will update once the webhook arrives." : "Payment received — waiting for Dodo's signed confirmation to activate your plan…"}
    </Card>
  );
}
