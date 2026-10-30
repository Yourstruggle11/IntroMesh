import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, or } from "drizzle-orm";
import { ArrowLeft, Compass, ExternalLink, Handshake, QrCode } from "lucide-react";
import { db } from "@/db";
import { connections, users } from "@/db/schema";
import { PathViz, type VizNode } from "@/components/mesh/path-viz";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, Card, Tag } from "@/components/ui/primitives";
import { requireOnboardedUser } from "@/lib/auth";
import { nodeDetails, pathsTo, reachable, userNode } from "@/lib/graph";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireOnboardedUser(`/people/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(users).where(and(eq(users.id, id), eq(users.onboarded, true))).limit(1);
  if (!p) notFound();
  const isMe = p.id === me.id;

  // Mutual connections
  const edges = await db
    .select({ a: connections.userA, b: connections.userB })
    .from(connections)
    .where(or(inArray(connections.userA, [me.id, p.id]), inArray(connections.userB, [me.id, p.id])));
  const neighbours = (uid: string) => new Set(edges.filter((e) => e.a === uid || e.b === uid).map((e) => (e.a === uid ? e.b : e.a)));
  const mine = neighbours(me.id);
  const theirs = neighbours(p.id);
  const connected = mine.has(p.id);
  const mutualIds = [...mine].filter((x) => theirs.has(x));
  const mutuals = mutualIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, mutualIds.slice(0, 8))) : [];

  let path: VizNode[] | null = null;
  if (!isMe && !connected) {
    const { reach } = await reachable(me.id, 3);
    const best = pathsTo(reach, userNode(p.id), 1)[0];
    if (best) {
      const info = await nodeDetails(best);
      path = best.map((nid, i) => ({
        id: nid,
        name: i === 0 ? "You" : info.get(nid)?.name ?? "Member",
        sub: i === 0 ? undefined : [info.get(nid)?.role, info.get(nid)?.company].filter(Boolean).join(" · ") || undefined,
        role: i === 0 ? "you" : i === best.length - 1 ? "target" : i === best.length - 2 ? "connector" : "hop",
      }));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/home" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <Card className="ring-gradient relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={p.name} seed={`u:${p.id}`} size={88} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
              {connected && <Badge tone="success">Connected</Badge>}
              {isMe && <Badge tone="brand">You</Badge>}
            </div>
            <p className="mt-1 text-muted">{p.headline}</p>
            <p className="mt-1 text-sm text-subtle">{[p.role, p.company].filter(Boolean).join(" · ")}</p>
          </div>
          {p.linkedinUrl && (
            <a href={p.linkedinUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
              LinkedIn <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="relative mt-6 grid gap-5 sm:grid-cols-2">
          {p.lookingFor.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">Looking for</p>
              <div className="flex flex-wrap gap-1.5">{p.lookingFor.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            </div>
          )}
          {p.canIntroduce.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-3">Can introduce you to</p>
              <div className="flex flex-wrap gap-1.5">{p.canIntroduce.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            </div>
          )}
          {p.tags.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Topics</p>
              <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            </div>
          )}
        </div>
      </Card>

      {!isMe && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Handshake className="h-4 w-4 text-brand" /> {mutualIds.length} mutual connection{mutualIds.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {mutuals.map((m) => (
                <Link key={m.id} href={`/people/${m.id}`} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs hover:border-line-strong">
                  <Avatar name={m.name} seed={`u:${m.id}`} size={22} /> {firstName(m.name)}
                </Link>
              ))}
              {mutualIds.length === 0 && <p className="text-sm text-muted">No mutuals yet.</p>}
            </div>
          </Card>
          <Card className="p-5">
            {connected ? (
              <>
                <p className="text-sm font-semibold">You know {firstName(p.name)}</p>
                <p className="mt-1 text-sm text-muted">Reach out directly — or ask them for intros into their network.</p>
                <ButtonLink href={`/discover?q=${encodeURIComponent(p.company ?? p.name)}`} variant="secondary" size="sm" className="mt-4">
                  <Compass className="h-4 w-4" /> Explore their network
                </ButtonLink>
              </>
            ) : path ? (
              <>
                <p className="text-sm font-semibold">Warmest path to {firstName(p.name)}</p>
                <div className="mt-4">
                  <PathViz nodes={path} size="sm" />
                </div>
                <ButtonLink href={`/discover?q=${encodeURIComponent(p.name)}`} size="sm" className="mt-4">
                  Request an intro
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Not in your mesh yet</p>
                <p className="mt-1 text-sm text-muted">{firstName(p.name)} is at the house — say hi and scan each other&apos;s QR.</p>
                <ButtonLink href="/connect" variant="secondary" size="sm" className="mt-4">
                  <QrCode className="h-4 w-4" /> Open my QR
                </ButtonLink>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
