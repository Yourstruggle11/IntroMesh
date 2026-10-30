import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count, desc } from "drizzle-orm";
import { CheckCircle2, Mail, Wallet, XCircle } from "lucide-react";
import { db, usingEmbeddedDb } from "@/db";
import { connections, contacts, emails, introRequests, users } from "@/db/schema";
import { AdminActions, RetryEmail } from "@/components/admin/admin-client";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { aiEnabled } from "@/lib/ai";
import { aiDescribe } from "@/lib/ai/provider";
import { isAdmin, requireOnboardedUser } from "@/lib/auth";
import { CHAINS, addressUrl, formatUnits6 } from "@/lib/crypto/chains";
import { walletBalances, walletConfigured } from "@/lib/crypto/payments";
import { dodoConfigured } from "@/lib/dodo";
import { smtpConfigured } from "@/lib/email";
import { tgConfigured, tgGraph } from "@/lib/graph/tigergraph";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

function Status({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {detail && <p className="truncate text-[11px] text-subtle">{detail}</p>}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireOnboardedUser("/admin");
  if (!isAdmin(user)) notFound();
  const [[u], [c], [ct], [i], mail, wallet] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(connections),
    db.select({ n: count() }).from(contacts),
    db.select({ n: count() }).from(introRequests),
    db.select().from(emails).orderBy(desc(emails.createdAt)).limit(25),
    walletConfigured() ? walletBalances().catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Control room" description="Integration health, graph operations, wallet and the email outbox." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Status ok label="Database" detail={usingEmbeddedDb() ? "Embedded PGlite (local dev)" : "Supabase Postgres"} />
        <Status ok={aiEnabled()} label="AI providers" detail={aiEnabled() ? aiDescribe() : "No AI keys — using built-in fallbacks"} />
        <Status ok={smtpConfigured()} label="Email (SMTP)" detail={smtpConfigured() ? process.env.SMTP_HOST : "Not configured — emails are logged"} />
        <Status ok={tgConfigured()} label="TigerGraph" detail={tgConfigured() ? `graph ${tgGraph()}` : "Not configured — Postgres fallback"} />
        <Status ok={walletConfigured()} label="Crypto wallet" detail={wallet?.address ?? "WALLET_PRIVATE_KEY missing"} />
        <Status ok={dodoConfigured()} label="Dodo Payments" detail={dodoConfigured() ? process.env.DODO_ENV || "test_mode" : "API key / product IDs missing"} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Users", u?.n],
          ["Connections", c?.n],
          ["Private contacts", ct?.n],
          ["Intro requests", i?.n],
        ].map(([label, n]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{Number(n ?? 0)}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminActions />
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-gold" /> Server wallet
          </p>
          {!wallet ? (
            <p className="mt-3 text-sm text-muted">Not configured, or RPC unreachable.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {wallet.balances.map((b) => (
                <li key={b.chain} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <a href={addressUrl(b.chain, wallet.address)} target="_blank" rel="noreferrer" className="hover:underline">
                    {CHAINS[b.chain].label}
                  </a>
                  <span className="font-mono text-xs">
                    {b.usdc === null ? "—" : `${formatUnits6(b.usdc)} USDC`} · {b.gas === null ? "—" : `${(Number(b.gas) / 1e18).toFixed(5)} ${CHAINS[b.chain].gas}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <p className="flex items-center gap-2 p-5 pb-3 text-sm font-semibold">
          <Mail className="h-4 w-4 text-brand" /> Email outbox
        </p>
        <ul className="divide-y divide-line">
          {mail.map((m) => (
            <li key={m.id} className="px-5 py-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                  <Badge tone={m.status === "sent" ? "success" : m.status === "failed" ? "danger" : m.status === "logged" ? "neutral" : "warning"}>{m.status}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted">{m.kind} →</span> {m.to} · {m.subject}
                  </span>
                  {m.status === "failed" && <RetryEmail id={m.id} />}
                  <span className="shrink-0 text-xs text-subtle">{timeAgo(m.createdAt)}</span>
                </summary>
                {m.error && <p className="mt-2 text-xs text-danger">{m.error}</p>}
                {m.cc.length > 0 && <p className="mt-2 text-xs text-muted">CC: {m.cc.join(", ")}</p>}
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/30 p-3 text-xs text-fg/80">{m.text}</pre>
              </details>
            </li>
          ))}
          {mail.length === 0 && <li className="px-5 pb-5 text-sm text-muted">No emails yet.</li>}
        </ul>
      </Card>
    </>
  );
}
