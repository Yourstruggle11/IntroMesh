"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, Coins, Cpu, Database, Lock, Search, Sparkles, Users, Wand2, Zap } from "lucide-react";
import { toast } from "sonner";
import { createIntroAction, polishReasonAction } from "@/app/actions/intros";
import { PathViz, type VizNode } from "@/components/mesh/path-viz";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DictationButton } from "@/components/ui/client";
import { Avatar, Badge, Card, EmptyState, FieldHint, Input, Label, Skeleton, Tag, Textarea } from "@/components/ui/primitives";
import type { DiscoverPath, DiscoverResponse, DiscoverResult, PublicNode } from "@/lib/discover";
import { cn, firstName } from "@/lib/utils";

const SUGGESTIONS = ["seed investor", "Solana devrel", "payments founder", "AI agents", "design partner", "Polygon"];

type ChainOpt = { key: string; label: string };

export function DiscoverClient({ initialQuery, data, chains, defaultChain, maxBountyUsd, bountiesReady }: { initialQuery: string; data: DiscoverResponse | null; chains: ChainOpt[]; defaultChain: string; maxBountyUsd: number; bountiesReady: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [searching, startSearch] = useTransition();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<{ result: DiscoverResult; path: DiscoverPath } | null>(null);

  const go = (query: string) => {
    const v = query.trim();
    startSearch(() => router.push(v ? `/discover?q=${encodeURIComponent(v)}` : "/discover"));
  };

  // Stream AI explanations for the top results after render.
  useEffect(() => {
    if (!data?.results.length) return;
    const top = data.results.filter((r) => !r.alreadyConnected && r.paths.length).slice(0, 6);
    if (!top.length) return;
    let cancelled = false;
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: data.query,
        items: top.map((r) => ({
          key: r.key,
          target: [r.target.masked ? "a private contact" : r.target.name, r.target.role, r.target.company].filter(Boolean).join(", "),
          connector: r.paths[0].connector.name,
          hops: r.hops,
          via: r.paths[0].nodes.slice(1, -2).map((n) => n.name),
          signals: r.signals.slice(0, 5),
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!cancelled && j?.reasons) setReasons(j.reasons);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="glass-strong ring-gradient relative flex items-center gap-2 rounded-2xl p-2"
      >
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Who do you want to meet? Try “seed investor in payments”"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-subtle"
          aria-label="Search"
        />
        <Button type="submit" loading={searching} className="shrink-0">
          <span className="hidden sm:inline">Find paths</span>
          <ArrowRight className="h-4 w-4 sm:hidden" />
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => { setQ(s); go(s); }} className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-fg">
            {s}
          </button>
        ))}
      </div>

      {searching && <ResultsSkeleton />}

      {!searching && data && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone={data.engine === "tigergraph" ? "violet" : "neutral"} className="gap-1.5 font-mono">
              {data.engine === "tigergraph" ? <Cpu className="h-3 w-3" /> : <Database className="h-3 w-3" />}
              {data.engine === "tigergraph" ? "TigerGraph" : "Graph engine"} · {data.ms}ms
            </Badge>
            <span>{data.reachable} people reachable within 3 hops</span>
            {data.query && data.keywords.length > 0 && (
              <span className="hidden md:inline">· matching {data.keywords.slice(0, 5).map((k) => `“${k}”`).join(", ")}</span>
            )}
          </div>

          {data.results.length === 0 && data.cold.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={data.query ? "No warm paths for that yet" : "Your mesh is just getting started"}
              description={data.query ? "Try a broader search, or grow your mesh — every QR scan opens new paths." : "Connect with a few people at the house and their networks become yours to explore."}
              action={<ButtonLink href="/connect" size="sm">Grow my mesh</ButtonLink>}
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {data.results.map((r, i) => (
                  <motion.div key={r.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                    <ResultCard r={r} reason={reasons[r.key]} onRequest={(path) => setRequest({ result: r, path })} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.cold.length > 0 && (
                <div className="pt-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Zap className="h-4 w-4 text-gold" /> In the house, not in your mesh yet
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.cold.map((c) => (
                      <Card key={c.target.id} className="flex items-center gap-3 p-4">
                        <Avatar name={c.target.name} seed={c.target.id} size={40} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/people/${c.target.id.slice(2)}`} className="block truncate text-sm font-medium hover:underline">{c.target.name}</Link>
                          <p className="truncate text-xs text-muted">{c.target.headline || [c.target.role, c.target.company].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span className="text-[11px] text-subtle">Go say hi</span>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {request && (
        <RequestDialog
          key={request.result.key + request.path.connector.id}
          result={request.result}
          path={request.path}
          onClose={() => setRequest(null)}
          chains={chains}
          defaultChain={defaultChain}
          maxBountyUsd={maxBountyUsd}
          bountiesReady={bountiesReady}
        />
      )}
    </div>
  );
}

function toViz(path: DiscoverPath): VizNode[] {
  return path.nodes.map((n, i) => ({
    id: n.id,
    name: n.name,
    sub: i === 0 ? "You" : [n.role, n.company].filter(Boolean).join(" · ") || undefined,
    masked: n.masked,
    role: i === 0 ? "you" : i === path.nodes.length - 1 ? "target" : i === path.nodes.length - 2 ? "connector" : "hop",
  }));
}

function TargetLine({ t }: { t: PublicNode }) {
  return <>{[t.role, t.company].filter(Boolean).join(" at ") || (t.masked ? "Private contact" : "Member")}</>;
}

function ResultCard({ r, reason, onRequest }: { r: DiscoverResult; reason?: string; onRequest: (p: DiscoverPath) => void }) {
  const [showAll, setShowAll] = useState(false);
  const best = r.paths[0];
  return (
    <Card className="overflow-hidden transition hover:border-line-strong">
      <div className="flex items-start gap-4 p-5">
        <Avatar name={r.target.name} seed={r.target.id} size={48} masked={r.target.masked} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {r.target.kind === "user" ? (
              <Link href={`/people/${r.target.id.slice(2)}`} className="truncate text-[15px] font-semibold hover:underline">{r.target.name}</Link>
            ) : (
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                <Lock className="h-3.5 w-3.5 text-muted" /> {r.target.name}
              </span>
            )}
            {r.alreadyConnected ? <Badge tone="success">Connected</Badge> : <Badge tone={r.hops === 2 ? "brand" : "violet"}>{r.hops === 2 ? "2nd" : "3rd"}° · {r.paths.length} path{r.paths.length > 1 ? "s" : ""}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            <TargetLine t={r.target} />
          </p>
          {r.target.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.target.tags.slice(0, 4).map((t) => (
                <Tag key={t} active={r.matched.some((m) => t.includes(m) || m.includes(t))}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>

      {r.alreadyConnected ? (
        <div className="flex items-center justify-between border-t border-line bg-white/[0.02] px-5 py-3 text-sm text-muted">
          You already know {firstName(r.target.name)} — reach out directly.
          <ButtonLink href={`/people/${r.target.id.slice(2)}`} size="sm" variant="secondary">Profile</ButtonLink>
        </div>
      ) : (
        <>
          <div className="border-t border-line bg-surface/50 px-5 py-4">
            <PathViz nodes={toViz(best)} size="sm" />
            {r.paths.length > 1 && (
              <>
                <button onClick={() => setShowAll((s) => !s)} className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition", showAll && "rotate-180")} /> {showAll ? "Hide" : "Show"} {r.paths.length - 1} other path{r.paths.length > 2 ? "s" : ""}
                </button>
                {showAll && (
                  <div className="mt-3 space-y-3">
                    {r.paths.slice(1).map((p) => (
                      <div key={p.connector.id + p.nodes.length} className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                        <PathViz nodes={toViz(p)} size="sm" className="flex-1" />
                        <Button size="sm" variant="secondary" onClick={() => onRequest(p)}>
                          Via {firstName(p.connector.name)}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 text-sm">
              <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
                <Sparkles className="h-3 w-3" /> Why this path
              </span>
              {reason ? <p className="text-fg/85">{reason}</p> : <div className="space-y-1.5 pt-1"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>}
            </div>
            {r.openRequest ? (
              <ButtonLink href={`/intros/${r.openRequest.id}`} variant="secondary" size="sm">View request</ButtonLink>
            ) : (
              <Button onClick={() => onRequest(best)} className="shrink-0">
                Ask {firstName(best.connector.name)} for an intro <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function RequestDialog({ result, path, onClose, chains, defaultChain, maxBountyUsd, bountiesReady }: { result: DiscoverResult; path: DiscoverPath; onClose: () => void; chains: ChainOpt[]; defaultChain: string; maxBountyUsd: number; bountiesReady: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [bountyOn, setBountyOn] = useState(false);
  const [amount, setAmount] = useState(Math.min(10, maxBountyUsd));
  const [chain, setChain] = useState(defaultChain);
  const [polishing, startPolish] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const targetLabel = [result.target.masked ? "a private contact" : result.target.name, result.target.role, result.target.company].filter(Boolean).join(", ");
  const presets = useMemo(() => [1, 5, 10, 25, 50, 100, 200].filter((p) => p <= maxBountyUsd), [maxBountyUsd]);
  const onDictate = useCallback((t: string) => setReason((r) => (r ? `${r.trimEnd()} ${t}` : t)), []);

  // Dictated text is long and easy to lose. Keep a per-request draft in the browser.
  const draftKey = `intromesh:draft:${result.target.id}:${path.connector.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setReason(saved);
    } catch {
      /* storage unavailable (private mode) */
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      if (reason) localStorage.setItem(draftKey, reason);
      else localStorage.removeItem(draftKey);
    } catch {
      /* storage unavailable */
    }
  }, [draftKey, reason]);

  const submit = () =>
    startSubmit(async () => {
      const r = await createIntroAction({ target: result.target.id, connectorId: path.connector.id, reason, bountyUsd: bountyOn ? amount : null, chain: bountyOn ? chain : null });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* storage unavailable */
      }
      if ("orderId" in r && r.orderId) {
        toast.success("Request created — fund the bounty to send it.");
        router.push(`/pay/${r.orderId}`);
      } else {
        toast.success(`Request sent to ${firstName(path.connector.name)} ✨`);
        router.push(`/intros/${r.introId}`);
      }
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`Ask ${firstName(path.connector.name)} for an intro`} description={<>To {targetLabel}</>} className="sm:max-w-xl">
      <div className="rounded-2xl border border-line bg-surface/60 p-4">
        <PathViz nodes={toViz(path)} size="sm" />
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="reason" className="mb-0">Why do you want this intro?</Label>
          <DictationButton onText={onDictate} className="h-8" />
        </div>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="I'm raising a seed round for stablecoin payroll and they lead payments deals at…" maxLength={1500} className="min-h-[110px]" />
        <div className="mt-2 flex items-center justify-between">
          <FieldHint>Specific beats generic. {firstName(path.connector.name)} sees this first.</FieldHint>
          <button
            type="button"
            disabled={polishing || reason.trim().length < 10}
            onClick={() =>
              startPolish(async () => {
                const r = await polishReasonAction(reason, targetLabel);
                if (r.ok) setReason(r.text);
                else toast.error(r.error);
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-brand disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" /> {polishing ? "Polishing…" : "Polish with AI"}
          </button>
        </div>
      </div>

      <div className={cn("mt-5 rounded-2xl border p-4 transition", bountyOn ? "border-gold/30 bg-gold/[0.05]" : "border-line")}>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Coins className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">Add a USDC bounty</span>
              <span className="block text-xs text-muted">Paid to {firstName(path.connector.name)} only if you actually meet. Refunded otherwise.</span>
            </span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={bountyOn} onChange={(e) => setBountyOn(e.target.checked)} disabled={!bountiesReady} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-gold peer-disabled:opacity-40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
        {!bountiesReady && <p className="mt-2 text-xs text-subtle">Bounties will be enabled once the payment wallet is configured.</p>}
        {bountyOn && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)} className={cn("rounded-xl border px-3 py-1.5 font-mono text-sm transition", amount === p ? "border-gold/50 bg-gold/15 text-gold" : "border-line text-muted hover:text-fg")}>
                  ${p}
                </button>
              ))}
              <div className="flex items-center gap-1 rounded-xl border border-line px-2">
                <span className="text-sm text-muted">$</span>
                <Input type="number" min={1} max={maxBountyUsd} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(maxBountyUsd, Number(e.target.value) || 1)))} className="h-8 w-16 border-0 bg-transparent px-1 font-mono focus:ring-0" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {chains.map((c) => (
                <button key={c.key} type="button" onClick={() => setChain(c.key)} className={cn("rounded-xl border px-3 py-1.5 text-xs transition", chain === c.key ? "border-brand/50 bg-brand/10 text-brand" : "border-line text-muted hover:text-fg")}>
                  USDC on {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-subtle">Your plan allows bounties up to ${maxBountyUsd}. You&apos;ll pay from any wallet (Cake Wallet works great) on the next screen.</p>
          </div>
        )}
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={submit} loading={submitting} disabled={reason.trim().length < 15}>
        {bountyOn ? `Continue to fund $${amount} bounty` : `Send request to ${firstName(path.connector.name)}`} <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="mt-3 text-center text-xs text-subtle">Nothing is shared with {result.target.masked ? "the contact" : firstName(result.target.name)} until {firstName(path.connector.name)} approves.</p>
    </Dialog>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="mt-5 h-12 w-full rounded-xl" />
        </Card>
      ))}
    </div>
  );
}
