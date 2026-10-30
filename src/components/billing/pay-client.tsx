"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { renewBountyOrderAction, submitTxHashAction } from "@/app/actions/billing";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/client";
import { Badge, Card, Input, Label } from "@/components/ui/primitives";

type Order = { id: string; status: string; purpose: string; introRequestId: string | null; amount: string; usd: string; treasury: string; txHash: string | null; expiresAt: string };
type ChainInfo = { key: string; label: string; gas: string; explorer: string; usdc: string; testnet: boolean };

function useCountdown(to: string) {
  const [left, setLeft] = useState(() => new Date(to).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(to).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [to]);
  const s = Math.max(0, Math.floor(left / 1000));
  return { expired: left <= 0, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` };
}

export function PayClient({ order, chain, what, qrSvg }: { order: Order; chain: ChainInfo; what: string; qrSvg: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [txHash, setTxHash] = useState(order.txHash);
  const [manual, setManual] = useState("");
  const [verifying, startVerify] = useTransition();
  const [renewing, startRenew] = useTransition();
  const { expired, label } = useCountdown(order.expiresAt);

  useEffect(() => {
    if (status !== "pending") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pay/${order.id}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!stop) {
            setStatus(j.status);
            setTxHash(j.txHash);
          }
        }
      } catch {
        /* network blip */
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [status, order.id]);

  const doneHref = order.purpose === "bounty" && order.introRequestId ? `/intros/${order.introRequestId}` : "/billing?paid=1";

  if (status === "paid") {
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Payment verified on {chain.label}</h1>
        <p className="mt-2 text-muted">{order.purpose === "bounty" ? "Your bounty is held and the connector has been notified." : "Your plan is active. Enjoy!"}</p>
        {txHash && (
          <a href={`${chain.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">
            View transaction <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <ButtonLink href={doneHref} size="lg" className="mt-8 w-full">
          Continue
        </ButtonLink>
      </div>
    );
  }

  if (status !== "pending" || expired) {
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-4 text-2xl font-semibold">This payment request {status === "cancelled" ? "was cancelled" : "expired"}</h1>
        <p className="mt-2 text-sm text-muted">If you already sent funds, paste the transaction hash below and we&apos;ll match it.</p>
        {manualVerify()}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {status !== "cancelled" && order.purpose === "bounty" && order.introRequestId && (
            <Button
              loading={renewing}
              onClick={() =>
                startRenew(async () => {
                  const r = await renewBountyOrderAction(order.introRequestId!);
                  if (r?.error) toast.error(r.error);
                })
              }
            >
              Get a fresh payment link
            </Button>
          )}
          <ButtonLink href={order.purpose === "bounty" && order.introRequestId ? `/intros/${order.introRequestId}` : "/billing"} variant="secondary">
            Back
          </ButtonLink>
        </div>
      </div>
    );
  }

  function manualVerify() {
    return (
      <form
        className="mt-5 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          startVerify(async () => {
            const r = await submitTxHashAction(order.id, manual.trim());
            if (r.error) toast.error(r.error);
            else if (r.ok) {
              setStatus("paid");
              router.refresh();
            }
          });
        }}
      >
        <Label htmlFor="tx">Already paid? Paste the transaction hash</Label>
        <div className="flex gap-2">
          <Input id="tx" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
          <Button type="submit" variant="secondary" loading={verifying} disabled={manual.trim().length < 66}>
            Verify
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone="gold" className="px-3 py-1">
            <Wallet className="h-3.5 w-3.5" /> Pay with USDC on {chain.label}
          </Badge>
          {chain.testnet && (
            <Badge tone="violet" className="px-3 py-1">
              Testnet · no real money
            </Badge>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Send exactly <span className="text-gold font-mono">{order.amount} USDC</span>
        </h1>
        <p className="mt-2 text-sm text-muted">{what} · ≈ ${order.usd}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="ring-gradient mx-auto w-full max-w-sm p-5">
          <div className="rounded-3xl bg-white p-5">
            <div className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-brand" /> Watching {chain.label} for your payment…
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-subtle">
            <Clock className="h-3.5 w-3.5" /> Expires in {label}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <ol className="space-y-5 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs text-brand">1</span>
                <div className="min-w-0 flex-1">
                  {chain.testnet ? (
                    <>
                      <p className="font-medium">Open a wallet that supports {chain.label}</p>
                      <p className="mt-0.5 text-muted">
                        MetaMask, Coinbase Wallet or Rabby (Cake Wallet is mainnet-only). Get free test USDC at{" "}
                        <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="text-brand underline">
                          faucet.circle.com
                        </a>{" "}
                        and a little free test {chain.gas} from any {chain.label} faucet.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Open Cake Wallet (or any wallet) on {chain.label}</p>
                      <p className="mt-0.5 text-muted">Scan the QR, or copy the details below. You need a little {chain.gas} for gas.</p>
                    </>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs text-brand">2</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Send USDC to</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] p-2.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs">{order.treasury}</code>
                    <CopyButton value={order.treasury} label="Copy" toastText="Address copied" />
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 font-mono text-xs text-gold ring-1 ring-gold/30">3</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Exact amount (the last digits identify your payment)</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/[0.06] p-2.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-base font-semibold text-gold">{order.amount}</code>
                    <CopyButton value={order.amount} label="Copy" toastText="Amount copied" />
                  </div>
                </div>
              </li>
            </ol>
          </Card>
          <Card className="p-4 text-xs text-muted">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>
                IntroMesh verifies the transfer directly on-chain — token contract <code className="font-mono text-fg/80">{chain.usdc.slice(0, 6)}…{chain.usdc.slice(-4)}</code> (native USDC). No card, no middleman.
              </span>
            </p>
          </Card>
          <Card className="p-4">
            {manualVerify()}
          </Card>
          <p className="text-center text-xs text-subtle">
            Changed your mind? <Link href={order.purpose === "bounty" && order.introRequestId ? `/intros/${order.introRequestId}` : "/billing"} className="underline">Go back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
