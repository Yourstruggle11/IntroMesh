import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, users } from "@/db/schema";
import { Logo } from "@/components/brand/logo";
import { ConnectConfirm } from "@/components/connect/connect-confirm";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Card, Tag } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Connect" };

export default async function ConnectCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const me = await getCurrentUser();
  if (!me) redirect(`/signup?next=${encodeURIComponent(`/c/${code}`)}`);
  if (!me.onboarded) redirect(`/onboarding?next=${encodeURIComponent(`/c/${code}`)}`);

  const [other] = await db
    .select({ id: users.id, name: users.name, headline: users.headline, role: users.role, company: users.company, tags: users.tags, lookingFor: users.lookingFor })
    .from(users)
    .where(eq(users.connectCode, code))
    .limit(1);

  let already = false;
  if (other && other.id !== me.id) {
    const [a, b] = [me.id, other.id].sort();
    const [c] = await db.select({ id: connections.id }).from(connections).where(and(eq(connections.userA, a), eq(connections.userB, b))).limit(1);
    already = Boolean(c);
  }

  return (
    <div className="aurora flex min-h-dvh flex-col items-center px-5 py-8">
      <Logo href="/home" />
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        {!other ? (
          <Card className="p-6 text-center">
            <p className="text-lg font-semibold">Code not found</p>
            <p className="mt-2 text-sm text-muted">Double-check the code on their QR card.</p>
            <ButtonLink href="/connect" className="mt-5 w-full">Enter a code</ButtonLink>
          </Card>
        ) : other.id === me.id ? (
          <Card className="p-6 text-center">
            <p className="text-lg font-semibold">That&apos;s your own QR 🙂</p>
            <p className="mt-2 text-sm text-muted">Show it to someone else to connect.</p>
            <ButtonLink href="/connect" className="mt-5 w-full">Back to my QR</ButtonLink>
          </Card>
        ) : (
          <Card className="ring-gradient overflow-hidden p-6 text-center">
            <div className="mx-auto w-fit">
              <Avatar name={other.name} seed={`u:${other.id}`} size={84} />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{other.name}</h1>
            <p className="mt-1 text-sm text-muted">{other.headline || [other.role, other.company].filter(Boolean).join(" · ")}</p>
            {other.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {other.tags.slice(0, 4).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            )}
            {other.lookingFor.length > 0 && (
              <p className="mt-4 text-xs text-subtle">
                Looking for: <span className="text-gold">{other.lookingFor.slice(0, 3).join(", ")}</span>
              </p>
            )}
            <div className="mt-6">
              <ConnectConfirm code={code} name={other.name} otherId={other.id} already={already} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
