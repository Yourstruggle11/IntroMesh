import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { after } from "next/server";
import { ArrowRight, BellRing, CheckCircle2, Coins, Compass, Handshake, Inbox, Network, PartyPopper, QrCode, Sparkles, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/client";
import { Avatar, Badge, Card, CardHeader, EmptyState, Skeleton, Tag } from "@/components/ui/primitives";
import { recommendationBlurbs } from "@/lib/ai";
import { requireOnboardedUser } from "@/lib/auth";
import { usage } from "@/lib/billing";
import { formatUnits6 } from "@/lib/crypto/chains";
import { recommendations } from "@/lib/discover";
import { expireDue } from "@/lib/intros";
import { homeCounts, recentNotifications } from "@/lib/queries";
import { firstName, timeAgo } from "@/lib/utils";
import type { User } from "@/db/schema";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const h = new Date().getUTCHours() + 5.5; // IST for Goa
  const hour = (h + 24) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const user = await requireOnboardedUser("/home");
  const [counts, u, notes] = await Promise.all([homeCounts(user.id), usage(user), recentNotifications(user.id, 6)]);
  after(() => expireDue().catch(() => undefined));

  return (
    <>
      <PageHeader
        eyebrow={greeting()}
        title={<>Hey {firstName(user.name)} — who do you want to meet?</>}
        description="Search for anyone, and IntroMesh finds the warmest route through people you already trust."
        action={
          <>
            <ButtonLink href="/connect" variant="secondary">
              <QrCode className="h-4 w-4" /> My QR
            </ButtonLink>
            <ButtonLink href="/discover">
              <Compass className="h-4 w-4" /> Find a warm path
            </ButtonLink>
          </>
        }
      />

      {welcome && (
        <Card className="ring-gradient mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <PartyPopper className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">You&apos;re in the mesh!</p>
              <p className="mt-0.5 text-sm text-muted">Every QR you scan adds a trusted edge. Three scans and you&apos;ll start seeing warm paths across the house.</p>
            </div>
          </div>
          <ButtonLink href="/connect" size="sm">
            Show my QR <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Connections" value={<AnimatedNumber value={counts.connections} />} icon={<Users className="h-4 w-4" />} hint="Mutual, scanned in person" />
        <StatCard label="Intros you made" value={<AnimatedNumber value={counts.introsMade} />} icon={<Handshake className="h-4 w-4" />} tone="violet" hint="As the connector" />
        <StatCard label="Meetings landed" value={<AnimatedNumber value={counts.meetings} />} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" hint="Your requests that met" />
        <StatCard label="USDC earned" value={<AnimatedNumber value={Number(formatUnits6(counts.earnedUnits))} prefix="$" decimals={2} />} icon={<Coins className="h-4 w-4" />} tone="gold" hint="From intro bounties" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {(counts.awaitingMe > 0 || counts.toConfirm > 0) && (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BellRing className="h-4 w-4 text-gold" /> Needs your attention
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {counts.awaitingMe > 0 && (
                  <Link href="/intros?tab=inbox" className="group rounded-xl border border-line bg-white/[0.03] p-4 transition hover:border-brand/40">
                    <p className="text-2xl font-semibold">{counts.awaitingMe}</p>
                    <p className="mt-1 text-sm text-muted">intro request{counts.awaitingMe > 1 ? "s" : ""} waiting for your approval</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-brand">Review <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
                  </Link>
                )}
                {counts.toConfirm > 0 && (
                  <Link href="/intros?tab=sent" className="group rounded-xl border border-line bg-white/[0.03] p-4 transition hover:border-gold/40">
                    <p className="text-2xl font-semibold">{counts.toConfirm}</p>
                    <p className="mt-1 text-sm text-muted">intro{counts.toConfirm > 1 ? "s" : ""} to confirm — did you meet?</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-gold">Confirm <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
                  </Link>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> People you should meet</span>} description="Ranked by what you're looking for, what they need, and how warm the path is." />
            <Suspense fallback={<RecsSkeleton />}>
              <Recommendations user={user} />
            </Suspense>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{u.plan.name} plan</p>
              <Link href="/billing" className="text-xs text-brand hover:underline">Upgrade</Link>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">Intro requests this month</span>
                <span className="font-mono">
                  {u.requestsUsed}
                  <span className="text-subtle">/{u.requestsLimit ?? "∞"}</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${u.requestsLimit ? Math.min(100, (u.requestsUsed / u.requestsLimit) * 100) : 8}%` }} />
              </div>
              <p className="mt-3 text-xs text-subtle">Bounties up to ${u.plan.maxBountyUsd} · {u.contactsUsed}/{u.contactsLimit} private contacts</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Latest activity" action={<Link href="/notifications" className="text-xs text-brand hover:underline">All</Link>} />
            <div className="p-3">
              {notes.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted">Nothing yet — your intros will show up here.</p>
              ) : (
                <ul className="space-y-1">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <Link href={n.link ?? "/notifications"} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-white/15" : "bg-brand"}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm">{n.title}</p>
                          <p className="text-xs text-subtle">{timeAgo(n.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Network className="mt-0.5 h-5 w-5 text-brand-3" />
              <div>
                <p className="text-sm font-semibold">Add people you can introduce</p>
                <p className="mt-1 text-sm text-muted">Private contacts stay private — others only see “someone at Company in Role”.</p>
                <Link href="/connect?tab=contacts" className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  Add contacts <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

async function Recommendations({ user }: { user: User }) {
  const recs = await recommendations(user, 6);
  if (!recs.length) {
    return (
      <div className="p-5">
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="No matches yet" description="Add what you're looking for in your profile, or scan a few QR codes to grow your mesh." action={<ButtonLink href="/settings" size="sm" variant="secondary">Edit interests</ButtonLink>} />
      </div>
    );
  }
  const blurbs = await recommendationBlurbs(
    { name: user.name, lookingFor: user.lookingFor, tags: user.tags },
    recs.map((r) => ({ key: r.target.id, name: r.target.name, headline: r.target.headline, signals: r.signals })),
  );
  return (
    <ul className="grid gap-3 p-5 sm:grid-cols-2">
      {recs.map((r) => (
        <li key={r.target.id} className="group rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]">
          <div className="flex items-start gap-3">
            <Avatar name={r.target.name} seed={r.target.id} size={42} />
            <div className="min-w-0 flex-1">
              <Link href={`/people/${r.target.id.slice(2)}`} className="block truncate font-medium hover:underline">{r.target.name}</Link>
              <p className="truncate text-xs text-muted">{r.target.headline || [r.target.role, r.target.company].filter(Boolean).join(" · ")}</p>
            </div>
            {r.hops ? <Badge tone={r.hops === 2 ? "brand" : "violet"}>{r.hops === 2 ? "2nd" : "3rd"}°</Badge> : <Badge>In the house</Badge>}
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-fg/80">{blurbs[r.target.id]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.target.tags.slice(0, 3).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            {r.connector ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                via <Avatar name={r.connector.name} seed={r.connector.id} size={18} /> {firstName(r.connector.name)}
              </span>
            ) : (
              <span className="text-xs text-muted">Say hi & scan their QR</span>
            )}
            <Link href={`/discover?q=${encodeURIComponent(r.target.name)}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              Find path <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecsSkeleton() {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
