import { Suspense } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  Coins,
  CreditCard,
  EyeOff,
  FileText,
  GitBranch,
  HandCoins,
  MessageSquare,
  Mic,
  Network,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Table,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { HeroMesh } from "@/components/mesh/hero-mesh";
import { PathViz } from "@/components/mesh/path-viz";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/client";
import { Badge, Card, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { liveTotals, withDeadline } from "@/lib/stats";
import { formatUnits6 } from "@/lib/crypto/chains";
import { PLANS, formatUsd } from "@/lib/plans";
import { cn } from "@/lib/utils";

const PARTNERS = [
  { name: "TigerGraph", role: "Graph engine", what: "Runs the multi-hop warm-path search behind every Discover result.", icon: GitBranch, tone: "bg-brand-3/10 text-brand-3 ring-brand-3/25" },
  { name: "AI Grants India", role: "AI", what: "OpenAI credits power profile building, search expansion and intro drafts.", icon: Bot, tone: "bg-brand/10 text-brand ring-brand/25" },
  { name: "Wispr Flow", role: "Voice", what: "Dictate your profile and intro requests instead of typing them.", icon: Mic, tone: "bg-brand-2/10 text-brand-2 ring-brand-2/25" },
  { name: "Cake Wallet", role: "Wallet", what: "Pay intro bounties and plans in USDC, straight from your wallet.", icon: Wallet, tone: "bg-gold/10 text-gold ring-gold/25" },
  { name: "Dodo Payments", role: "Billing", what: "Card subscriptions, activated only by signed payment webhooks.", icon: CreditCard, tone: "bg-success/10 text-success ring-success/25" },
  { name: "viaSocket", role: "Automations", what: "Send intros and meetings to Slack, Sheets, HubSpot and 1,000+ apps.", icon: Workflow, tone: "bg-brand-2/10 text-brand-2 ring-brand-2/25" },
  { name: "Edge City", role: "Demo day", what: "Hosts the demo day where the top Hacker House teams pitch.", icon: Users, tone: "bg-brand-3/10 text-brand-3 ring-brand-3/25" },
];

export default function LandingPage() {
  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />
        <HeroMesh className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="max-w-2xl">
            <div className="animate-fade-up">
              <Badge tone="brand" className="gap-2 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Hacker House Goa 2026 · AI × Crypto
              </Badge>
            </div>
            <h1 className="mt-6 animate-fade-up text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-tight [animation-delay:80ms] sm:text-6xl">
              Your next customer is <span className="text-gradient">one trusted connection</span> away.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-pretty text-base leading-relaxed text-muted [animation-delay:160ms] sm:text-lg">
              IntroMesh finds the warmest path to the person you want to meet, drafts the intro with AI, and pays the
              connector in <span className="text-gold font-medium">USDC</span> the moment the meeting happens.
            </p>
            <div className="mt-8 flex animate-fade-up flex-col gap-3 [animation-delay:240ms] sm:flex-row">
              <ButtonLink href="/signup" size="lg">
                Join the mesh <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/live" variant="secondary" size="lg">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                See the live mesh
              </ButtonLink>
            </div>
          </div>

          <div className="mt-14 animate-fade-up [animation-delay:320ms] sm:mt-20">
            <Suspense fallback={<LiveStripSkeleton />}>
              <LiveStrip />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
        <SectionTitle
          eyebrow="How it works"
          title="From “who do I know?” to a booked meeting in minutes"
          description="Cold outreach is expensive. Trusted introductions are hard to find, ask for and measure. IntroMesh turns both into a single flow."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: QrCode, title: "Scan to connect", body: "Meet someone? Scan their QR. Both sides consent, and your mesh grows with every handshake." },
            { icon: Search, title: "Discover warm paths", body: "Search “Solana VC” or a company. TigerGraph finds every trusted route up to 3 hops away." },
            { icon: HandCoins, title: "Request + bounty", body: "Explain why: type it, or just say it with Wispr Flow. Then attach a USDC bounty for the connector." },
            { icon: BadgeCheck, title: "Meet & settle", body: "The connector approves an AI-drafted intro. When both sides confirm the meeting, the bounty pays out." },
          ].map((s, i) => (
            <Card key={s.title} className="group relative p-5 transition duration-300 hover:-translate-y-1 hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs text-subtle">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────── Path intelligence ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:pb-28">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="Relationship intelligence"
              title="Not just “you share a contact.” The exact route — and why."
              description="Every recommendation shows who can help, the path of trust behind it, and an AI explanation grounded in real signals. Private contacts stay private: others only ever see a role and a company."
            />
            <ul className="mt-8 space-y-3 text-sm">
              {[
                { icon: GitBranch, text: "Multi-hop graph traversal on TigerGraph, with a Postgres fallback" },
                { icon: Bot, text: "AI explanations, search expansion and intro drafts: OpenAI via AI Grants India, with Gemini as fallback" },
                { icon: EyeOff, text: "Masked private contacts — names revealed only by the connector" },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-muted">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
          <Card className="ring-gradient relative overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Search className="h-4 w-4" /> “seed investor in payments”
              </div>
              <Badge tone="violet" className="font-mono">TigerGraph · 14ms</Badge>
            </div>
            <div className="mt-6 rounded-2xl border border-line bg-surface/70 p-4">
              <PathViz
                nodes={[
                  { id: "you", name: "You", role: "you", sub: "Founder" },
                  { id: "a", name: "Priya Shah", role: "hop", sub: "Builder · Base" },
                  { id: "b", name: "Arjun Mehta", role: "connector", sub: "BD · Dodo" },
                  { id: "c", name: "M•••• K••••", role: "target", sub: "Partner · Seed fund", masked: true },
                ]}
              />
            </div>
            <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] p-3.5 text-sm leading-relaxed text-fg/90">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
                <Sparkles className="h-3.5 w-3.5" /> Why this path
              </span>
              Arjun works with seed-stage payments funds daily and connected with Priya at the house — your strongest trust chain to
              a partner who invests exactly where you&apos;re building.
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/20 bg-gold/[0.06] px-3.5 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-gold">
                <Coins className="h-4 w-4" /> Bounty on success
              </span>
              <span className="font-mono font-semibold text-gold">$10 USDC</span>
            </div>
          </Card>
        </div>
      </section>

      {/* ───────── Bounties ───────── */}
      <section id="bounties" className="relative scroll-mt-20 border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionTitle
              eyebrow="Intro bounties"
              title={
                <>
                  Trust, rewarded <span className="text-gold">on-chain</span>.
                </>
              }
              description="Attach a USDC bounty to any intro request. It's held while the connector decides, refunded if they decline, and paid out the moment both sides confirm the meeting happened."
            />
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {["Base", "Polygon", "Arbitrum"].map((c) => (
                <Badge key={c} tone="neutral" className="px-3 py-1 text-xs">
                  <Network className="h-3 w-3" /> {c}
                </Badge>
              ))}
              <Badge tone="gold" className="px-3 py-1 text-xs">
                <Wallet className="h-3 w-3" /> Pay from Cake Wallet
              </Badge>
            </div>
            <p className="mt-4 text-xs text-subtle">Try it risk-free: testnet mode uses free test USDC on Base Sepolia, Polygon Amoy and Arbitrum Sepolia.</p>
          </div>
          <div className="relative">
            <ol className="relative space-y-3">
              {[
                { t: "Request", d: "You attach a USDC bounty ($1 up to your plan's cap) and send the exact amount to the IntroMesh wallet.", c: "text-brand" },
                { t: "Held", d: "IntroMesh verifies the transfer directly on-chain — no payment processor in the loop.", c: "text-brand-2" },
                { t: "Intro sent", d: "Connector approves and sends an AI-drafted email with everyone CC'd.", c: "text-brand-3" },
                { t: "Both confirm", d: "Requester confirms in-app, target confirms via a private link.", c: "text-gold" },
                { t: "Paid", d: "USDC lands in the connector's wallet. Declined or expired? Auto-refund.", c: "text-success" },
              ].map((s, i) => (
                <li key={s.t} className="glass flex items-start gap-4 rounded-2xl p-4">
                  <span className={cn("mt-0.5 font-mono text-xs font-semibold", s.c)}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-sm font-semibold">{s.t}</p>
                    <p className="mt-0.5 text-sm text-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────── Automations (viaSocket) ───────── */}
      <section id="automations" className="mx-auto max-w-6xl scroll-mt-20 px-5 pt-20 sm:pt-28">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="Automations · powered by viaSocket"
              title="Your intros, wherever you already work"
              description="Open viaSocket right inside IntroMesh and pipe your activity into Slack, Google Sheets, HubSpot, Notion and 1,000+ other apps. New request? Ping your team. Meeting confirmed? Log it in your CRM."
            />
            <ul className="mt-8 space-y-3 text-sm">
              {[
                { icon: Workflow, text: "Build flows without leaving IntroMesh: no code, no API keys to juggle" },
                { icon: Zap, text: "Events for requests, sent intros, confirmed meetings, bounty payouts and new connections" },
                { icon: ShieldCheck, text: "Delivered only to https webhooks you control, and checked on every send" },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-muted">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-2" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
          <Card className="ring-gradient p-5 sm:p-6">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-4">
              <LogoMark size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">New intro request</p>
                <p className="truncate text-xs text-muted">Ravi wants an intro to a seed fund partner · $10 bounty</p>
              </div>
            </div>
            <div className="mx-auto my-2 h-8 w-[2px] animate-flow-y rounded-full" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(34,211,238,0.9) 0 10px, rgba(167,139,250,0.25) 10px 24px)", backgroundSize: "100% 48px" }} />
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-brand-2/30 bg-brand-2/10 px-4 py-1.5 text-sm font-medium text-brand-2">
              <Workflow className="h-4 w-4" /> viaSocket flow
            </div>
            <div className="mx-auto my-2 h-8 w-[2px] animate-flow-y rounded-full" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(34,211,238,0.9) 0 10px, rgba(167,139,250,0.25) 10px 24px)", backgroundSize: "100% 48px" }} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: MessageSquare, label: "Slack" },
                { icon: Table, label: "Sheets" },
                { icon: Briefcase, label: "HubSpot" },
                { icon: FileText, label: "Notion" },
              ].map((a) => (
                <div key={a.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-3 py-3 text-xs text-muted">
                  <a.icon className="h-4 w-4 text-fg/80" /> {a.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ───────── Consent ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <SectionTitle align="center" eyebrow="Consent by design" title="Your network is not a public database" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Owner controls every intro", body: "Nothing is shared and no one is emailed until the person who owns the relationship approves the exact message." },
            { icon: EyeOff, title: "Minimum disclosure", body: "Private contacts surface only as “someone at Company X in Role Y”. No contact lists, no scraping, no resale." },
            { icon: BadgeCheck, title: "Verified outcomes", body: "Meetings are confirmed by both sides. Payments are verified on-chain or by signed webhooks — never by a redirect." },
          ].map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="h-5 w-5 text-brand" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────── Partners ───────── */}
      <section id="partners" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-20 sm:pb-28">
        <SectionTitle align="center" eyebrow="Hacker House Goa 2026" title="Built with our partners" description="The partners behind IntroMesh, and the part of the product each one powers." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTNERS.map((p) => (
            <Card key={p.name} className="group relative flex flex-col p-5 transition duration-300 hover:-translate-y-1 hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", p.tone)}>
                  <p.icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">{p.role}</span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold">{p.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.what}</p>
            </Card>
          ))}
          <Card className="flex flex-col justify-center p-5 text-center sm:col-span-2 lg:col-span-1">
            <LogoMark size={40} className="mx-auto" />
            <p className="mt-3 text-sm font-semibold">Made in 4 days</p>
            <p className="mt-1 text-xs text-muted">at Bells Beach Resort, Calangute · 28 to 31 Oct 2026</p>
          </Card>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24">
        <SectionTitle align="center" eyebrow="Pricing" title="Free to start. Pay by card or stablecoin." description="Subscribe with a card through Dodo Payments, or prepay any plan in USDC from Cake Wallet or any EVM wallet." />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {Object.values(PLANS).map((p) => (
            <Card key={p.id} className={cn("relative flex flex-col p-6", p.highlight && "ring-gradient bg-brand/[0.04]")}>
              {p.highlight && (
                <Badge tone="brand" className="absolute right-5 top-5">
                  Most popular
                </Badge>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.priceCents ? formatUsd(p.priceCents) : "$0"}</span>
                <span className="text-sm text-muted">/ month</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-fg/85">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}
                  </li>
                ))}
              </ul>
              <ButtonLink href={p.id === "free" ? "/signup" : `/signup?next=/billing`} variant={p.highlight ? "primary" : "secondary"} className="mt-8 w-full">
                {p.id === "free" ? "Start free" : `Get ${p.name}`}
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Card className="ring-gradient relative overflow-hidden px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
          <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Who do you want to meet before demo day?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">Join in 60 seconds. Describe yourself once — by voice or text — and let the mesh do the rest.</p>
          <div className="relative mt-8 flex justify-center">
            <ButtonLink href="/signup" size="lg">
              Join the mesh <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Card>
      </section>
    </>
  );
}

async function LiveStrip() {
  // One cached query; if it can't answer quickly, drop the strip rather than leave a skeleton spinning.
  const s = await withDeadline(liveTotals(), 3000).catch(() => null);
  if (!s) return null;
  const items = [
    { label: "Builders in the mesh", value: s.members },
    { label: "Trusted connections", value: s.connections },
    { label: "Warm intros made", value: s.introduced },
    { label: "USDC paid to connectors", value: Number(formatUnits6(s.paidUnits)), prefix: "$", decimals: 2 },
  ];
  return (
    <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-2xl lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="bg-bg/40 px-5 py-4">
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <AnimatedNumber value={it.value} prefix={it.prefix} decimals={it.decimals ?? 0} />
          </p>
          <p className="mt-1 text-xs text-muted">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

function LiveStripSkeleton() {
  return (
    <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-2xl lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-bg/40 px-5 py-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
