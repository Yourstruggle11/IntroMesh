import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Coins, ExternalLink, Mail, Quote, Wallet } from "lucide-react";
import { CancelButton, ConfirmMetButton, ConnectorPanel } from "@/components/intros/intro-actions";
import { PathViz, type VizNode } from "@/components/mesh/path-viz";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { requireOnboardedUser } from "@/lib/auth";
import { isChainKey, txUrl } from "@/lib/crypto/chains";
import { bountyLabel } from "@/lib/intros";
import { introDetail } from "@/lib/queries";
import { bountyStatus, introStatus } from "@/lib/status";
import { cn, firstName, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Intro" };

export default async function IntroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser(`/intros/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await introDetail(id, user);
  if (!d) notFound();
  const { intro, requester, connector, target, role } = d;
  const base = introStatus(intro.status);
  const s =
    role === "connector" && ["pending", "accepted"].includes(intro.status)
      ? { label: "Needs your decision", tone: "gold" as const, hint: "Approve and send the intro, or decline." }
      : role === "connector" && intro.status === "introduced"
        ? { ...base, hint: "Intro sent. Waiting for both sides to confirm they met." }
        : role === "target" && intro.status === "introduced"
          ? { ...base, hint: "Confirm once you've met." }
          : base;
  const bounty = bountyLabel(intro);
  const b = bountyStatus(intro.bountyStatus);
  const chain = intro.bountyChain && isChainKey(intro.bountyChain) ? intro.bountyChain : null;

  const viz: VizNode[] = (intro.path.length ? intro.path : [
    { id: `u:${requester.id}`, kind: "user" as const, name: requester.name },
    { id: `u:${connector.id}`, kind: "user" as const, name: connector.name },
    { id: "target", kind: "contact" as const, name: target.name, masked: target.masked },
  ]).map((n, i, arr) => ({
    id: n.id,
    name: n.id === `u:${user.id}` ? "You" : i === arr.length - 1 ? target.name : n.name,
    sub: [n.role, n.company].filter(Boolean).join(" · ") || undefined,
    masked: i === arr.length - 1 ? target.masked : n.masked,
    role: i === 0 ? "you" : i === arr.length - 1 ? "target" : i === arr.length - 2 ? "connector" : "hop",
  }));

  const steps = [
    { label: "Requested", done: true, at: intro.createdAt },
    ...(intro.bountyUnits ? [{ label: "Bounty funded", done: !["awaiting_payment", "none"].includes(intro.bountyStatus), at: null }] : []),
    { label: "Approved & sent", done: ["introduced", "met"].includes(intro.status), at: intro.introducedAt },
    { label: `${firstName(requester.name)} confirmed`, done: Boolean(intro.requesterConfirmedAt), at: intro.requesterConfirmedAt },
    { label: `${target.masked ? "Target" : firstName(target.name)} confirmed`, done: Boolean(intro.targetConfirmedAt), at: intro.targetConfirmedAt },
    ...(intro.bountyUnits ? [{ label: "Bounty paid", done: intro.bountyStatus === "paid", at: null }] : []),
  ];
  const closed = ["declined", "expired", "cancelled"].includes(intro.status);
  const introEmail = d.emails.find((e) => e.kind === "intro");

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/intros" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All intros
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.tone}>{s.label}</Badge>
            {bounty && (
              <Badge tone="gold">
                <Coins className="h-3 w-3" /> {bounty}
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {role === "connector" ? (
              <>
                {requester.name} wants to meet {target.name}
              </>
            ) : role === "requester" ? (
              <>Your intro to {target.name}</>
            ) : (
              <>
                {connector.name} introduced you to {requester.name}
              </>
            )}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{s.hint} · {timeAgo(intro.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <PathViz nodes={viz} />
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Avatar name={requester.name} seed={`u:${requester.id}`} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {requester.name} <span className="font-normal text-muted">{requester.headline ? `· ${requester.headline}` : ""}</span>
                </p>
                <div className="relative mt-2 rounded-2xl rounded-tl-sm border border-line bg-white/[0.03] p-4 text-[15px] leading-relaxed">
                  <Quote className="absolute -left-1 -top-2 h-4 w-4 text-brand/60" />
                  {intro.reason}
                </div>
              </div>
            </div>
          </Card>

          {role === "connector" && ["pending", "accepted"].includes(intro.status) && (
            <ConnectorPanel
              introId={intro.id}
              initialDraft={intro.draftBody ? { subject: intro.draftSubject ?? "", body: intro.draftBody } : null}
              targetEmailHint={`${target.name}${target.isUser ? " (member)" : " (your private contact)"}`}
              ccHint={`${requester.name}, you`}
            />
          )}

          {intro.status === "declined" && intro.declineNote && (
            <Card className="border-danger/20 p-5 text-sm">
              <p className="font-medium text-danger">Note from {firstName(connector.name)}</p>
              <p className="mt-1 text-muted">{intro.declineNote}</p>
            </Card>
          )}

          {intro.status === "introduced" && role === "requester" && !intro.requesterConfirmedAt && (
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Did you meet {target.name}?</p>
                <p className="mt-1 text-sm text-muted">{bounty ? "When both of you confirm, the bounty is released to " + firstName(connector.name) + "." : "Confirming tells " + firstName(connector.name) + " the intro landed."}</p>
              </div>
              <ConfirmMetButton introId={intro.id} as="requester" />
            </Card>
          )}
          {intro.status === "introduced" && role === "target" && !intro.targetConfirmedAt && (
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Did you meet {requester.name}?</p>
                <p className="mt-1 text-sm text-muted">One tap lets {firstName(connector.name)} know the intro worked.</p>
              </div>
              <ConfirmMetButton introId={intro.id} as="target" />
            </Card>
          )}
          {intro.status === "met" && (
            <Card className="ring-gradient flex items-center gap-4 p-5">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
              <div>
                <p className="font-semibold">Meeting confirmed by both sides 🤝</p>
                <p className="mt-0.5 text-sm text-muted">{intro.bountyStatus === "paid" ? `${bounty} was paid to ${connector.name}.` : intro.bountyStatus === "payout_pending" ? "Bounty payout is pending." : "Nice work, everyone."}</p>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm font-semibold">Timeline</p>
            <ol className="mt-4 space-y-3">
              {steps.map((st) => (
                <li key={st.label} className="flex items-center gap-3 text-sm">
                  {st.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className={cn("h-4 w-4 shrink-0", closed ? "text-subtle" : "text-muted")} />}
                  <span className={st.done ? "text-fg" : "text-muted"}>{st.label}</span>
                  {st.at && <span className="ml-auto text-[11px] text-subtle">{timeAgo(st.at)}</span>}
                </li>
              ))}
              {closed && (
                <li className="flex items-center gap-3 text-sm text-muted">
                  <Circle className="h-4 w-4 text-danger" /> {s.label}
                </li>
              )}
            </ol>
          </Card>

          {intro.bountyUnits && (
            <Card className="border-gold/20 bg-gold/[0.04] p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-gold">
                  <Coins className="h-4 w-4" /> Bounty
                </p>
                <Badge tone={b.tone}>{b.label}</Badge>
              </div>
              <p className="mt-3 font-mono text-2xl font-semibold text-gold">{bounty}</p>
              {intro.bountyStatus === "awaiting_payment" && role === "requester" && d.order && (
                <ButtonLink href={`/pay/${d.order.id}`} variant="gold" className="mt-4 w-full">
                  <Wallet className="h-4 w-4" /> Fund bounty
                </ButtonLink>
              )}
              {intro.bountyStatus === "payout_pending" && role === "connector" && (
                <p className="mt-3 text-xs text-muted">
                  {intro.bountyError?.includes("payout address") ? (
                    <>
                      Add your payout address in <Link className="text-brand underline" href="/settings#payout">Settings</Link> to receive it.
                    </>
                  ) : (
                    "Payout is being retried."
                  )}
                </p>
              )}
              <div className="mt-3 space-y-1.5 text-xs">
                {d.order?.txHash && chain && (
                  <a href={txUrl(chain, d.order.txHash, d.order.network)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted hover:text-fg">
                    Funding tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {intro.payoutTxHash && chain && (
                  <a href={txUrl(chain, intro.payoutTxHash, intro.bountyNetwork)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-success hover:underline">
                    Payout tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {intro.refundTxHash && chain && (
                  <a href={txUrl(chain, intro.refundTxHash, intro.bountyNetwork)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted hover:text-fg">
                    Refund tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          )}

          {introEmail && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-brand" /> Intro email
              </p>
              <p className="mt-2 text-sm text-muted">
                {introEmail.status === "sent" ? `Delivered ${timeAgo(introEmail.sentAt)}` : introEmail.status === "logged" ? "Recorded (SMTP not configured in this environment)" : introEmail.status === "failed" ? `Delivery failed: ${introEmail.error ?? "unknown error"}` : "Queued"}
              </p>
            </Card>
          )}

          {role === "requester" && ["awaiting_payment", "pending"].includes(intro.status) && (
            <div className="text-center">
              <CancelButton introId={intro.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
