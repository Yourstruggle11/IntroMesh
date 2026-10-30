import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { CheckCircle2, Handshake } from "lucide-react";
import { db } from "@/db";
import { introRequests, users } from "@/db/schema";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/primitives";
import { bountyLabel } from "@/lib/intros";
import { confirmMeetingFromToken } from "./actions";
import { SubmitButton } from "./submit-button";

export const metadata: Metadata = { title: "Confirm your meeting", robots: { index: false } };

export default async function ConfirmMeetingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const [intro] = await db.select().from(introRequests).where(eq(introRequests.targetConfirmToken, token)).limit(1);
  const people = intro ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [intro.requesterId, intro.connectorId])) : [];
  const name = (id?: string) => people.find((p) => p.id === id)?.name ?? "someone";
  const confirmed = Boolean(intro?.targetConfirmedAt) || done === "1";
  const bounty = intro && intro.bountyStatus === "held" ? bountyLabel(intro) : null;

  return (
    <div className="aurora flex min-h-dvh flex-col items-center px-5 py-8">
      <Logo />
      <div className="flex w-full max-w-md flex-1 items-center py-10">
        <Card className="ring-gradient w-full p-7 text-center">
          {!intro || !["introduced", "met"].includes(intro.status) ? (
            <>
              <p className="text-lg font-semibold">This link isn&apos;t active</p>
              <p className="mt-2 text-sm text-muted">The intro may have expired or been withdrawn.</p>
            </>
          ) : confirmed ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Thanks for confirming!</h1>
              <p className="mt-2 text-sm text-muted">
                {name(intro.connectorId)} will be glad the intro to {name(intro.requesterId)} worked out.
                {intro.bountyUnits ? " Their thank-you bounty is released once both sides confirm." : ""}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Handshake className="h-7 w-7" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Did you meet {name(intro.requesterId)}?</h1>
              <p className="mt-2 text-sm text-muted">
                {name(intro.connectorId)} introduced you. {bounty ? `Confirming releases a ${bounty} thank-you bounty to them.` : "Confirming lets them know the intro was useful."}
              </p>
              <form action={confirmMeetingFromToken} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <SubmitButton />
              </form>
              <p className="mt-4 text-xs text-subtle">If you haven&apos;t met, just close this page.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
