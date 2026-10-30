import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, Coins, Inbox, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { requireOnboardedUser } from "@/lib/auth";
import { bountyLabel, expireDue } from "@/lib/intros";
import { introLists, type IntroRow } from "@/lib/queries";
import { introStatus } from "@/lib/status";
import { cn, firstName, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Intros" };

const TABS = [
  { id: "inbox", label: "To approve", icon: Inbox },
  { id: "sent", label: "Requested", icon: Send },
  { id: "received", label: "Introduced to me", icon: Sparkles },
] as const;

export default async function IntrosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const user = await requireOnboardedUser("/intros");
  const lists = await introLists(user.id);
  after(() => expireDue().catch(() => undefined));
  const pendingInbox = lists.incoming.filter((r) => ["pending", "accepted"].includes(r.intro.status)).length;
  const tab = (TABS.find((t) => t.id === rawTab)?.id ?? (pendingInbox ? "inbox" : "sent")) as (typeof TABS)[number]["id"];
  const rows = tab === "inbox" ? lists.incoming : tab === "sent" ? lists.outgoing : lists.received;

  return (
    <>
      <PageHeader eyebrow="Introductions" title="Your intros" description="Approve requests from your network, and track the intros you've asked for — from request to meeting to payout." action={<ButtonLink href="/discover">New request <ArrowRight className="h-4 w-4" /></ButtonLink>} />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white/[0.02] p-1">
        {TABS.map((t) => {
          const n = t.id === "inbox" ? pendingInbox : t.id === "sent" ? lists.outgoing.length : lists.received.length;
          return (
            <Link key={t.id} href={`/intros?tab=${t.id}`} className={cn("flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition", tab === t.id ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}>
              <t.icon className="h-4 w-4" /> {t.label}
              {n > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold leading-5", t.id === "inbox" ? "bg-brand text-[#04121a]" : "bg-white/10 text-muted")}>{n}</span>}
            </Link>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={tab === "inbox" ? "No requests to approve" : tab === "sent" ? "You haven't requested any intros" : "No one has introduced you yet"}
          description={tab === "sent" ? "Search for someone you want to meet and we'll find the warmest path." : "As your mesh grows, requests will show up here."}
          action={tab === "sent" ? <ButtonLink href="/discover" size="sm">Discover people</ButtonLink> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <IntroListItem key={r.intro.id} row={r} perspective={tab} />
          ))}
        </ul>
      )}
    </>
  );
}

function IntroListItem({ row, perspective }: { row: IntroRow; perspective: "inbox" | "sent" | "received" }) {
  const s =
    perspective === "inbox" && ["pending", "accepted"].includes(row.intro.status)
      ? { label: "Needs your decision", tone: "gold" as const }
      : introStatus(row.intro.status);
  const bounty = bountyLabel(row.intro);
  const counterpart = perspective === "inbox" ? row.requester : perspective === "sent" ? row.connector : row.requester;
  const title =
    perspective === "inbox" ? (
      <>
        <b className="font-semibold">{row.requester.name}</b> → <b className="font-semibold">{row.target.name}</b>
      </>
    ) : perspective === "sent" ? (
      <>
        Intro to <b className="font-semibold">{row.target.name}</b> via {firstName(row.connector.name)}
      </>
    ) : (
      <>
        <b className="font-semibold">{row.connector.name}</b> introduced you to <b className="font-semibold">{row.requester.name}</b>
      </>
    );
  return (
    <li>
      <Link href={`/intros/${row.intro.id}`} className="glass group flex items-start gap-4 rounded-2xl p-4 transition hover:border-line-strong sm:items-center">
        <Avatar name={counterpart.name} seed={`u:${counterpart.id}`} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{row.intro.reason}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
            <Badge tone={s.tone}>{s.label}</Badge>
            {bounty && <Badge tone="gold"><Coins className="h-3 w-3" /> {bounty.split(" USDC")[0]}</Badge>}
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <div className="flex items-center gap-2">
            {bounty && <Badge tone="gold"><Coins className="h-3 w-3" /> {bounty.split(" USDC")[0]}</Badge>}
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <span className="text-[11px] text-subtle">{timeAgo(row.intro.createdAt)}</span>
        </div>
      </Link>
    </li>
  );
}
