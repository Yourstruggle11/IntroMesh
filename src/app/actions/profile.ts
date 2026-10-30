"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logEvent } from "@/lib/activity";
import { extractProfile, type ExtractedProfile } from "@/lib/ai";
import { requireUser, safeNext } from "@/lib/auth";
import { normalizeAddress } from "@/lib/crypto/payments";
import { syncUser } from "@/lib/graph";
import { retryPendingPayouts } from "@/lib/intros";
import { uniqTags } from "@/lib/utils";

export async function extractProfileAction(about: string): Promise<{ profile?: ExtractedProfile; error?: string }> {
  const user = await requireUser();
  const text = String(about ?? "").trim();
  if (text.length < 20) return { error: "Tell us a little more — a couple of sentences is perfect." };
  const profile = await extractProfile(text.slice(0, 2000), user.name);
  await db.update(users).set({ about: text.slice(0, 2000), updatedAt: new Date() }).where(eq(users.id, user.id));
  return { profile };
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(120).optional().default(""),
  role: z.string().trim().max(80).optional().default(""),
  company: z.string().trim().max(80).optional().default(""),
  linkedinUrl: z.string().trim().max(200).optional().default(""),
  payoutAddress: z.string().trim().max(64).optional().default(""),
  lookingFor: z.array(z.string()).max(12).default([]),
  canIntroduce: z.array(z.string()).max(12).default([]),
  tags: z.array(z.string()).max(12).default([]),
  showOnLeaderboard: z.boolean().optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfileAction(input: ProfileInput, opts: { finishOnboarding?: boolean; next?: string } = {}): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const p = parsed.data;
  let payout: string | null = null;
  if (p.payoutAddress) {
    payout = normalizeAddress(p.payoutAddress);
    if (!payout) return { error: "That payout address isn't a valid EVM address (0x…)." };
  }
  if (p.linkedinUrl && !/^https?:\/\/([a-z]+\.)?linkedin\.com\//i.test(p.linkedinUrl)) {
    return { error: "LinkedIn URL should look like https://www.linkedin.com/in/…" };
  }
  const hadPayout = Boolean(user.payoutAddress);
  await db
    .update(users)
    .set({
      name: p.name,
      headline: p.headline || null,
      role: p.role || null,
      company: p.company || null,
      linkedinUrl: p.linkedinUrl || null,
      payoutAddress: payout,
      lookingFor: uniqTags(p.lookingFor, 12),
      canIntroduce: uniqTags(p.canIntroduce, 12),
      tags: uniqTags(p.tags, 12),
      ...(p.showOnLeaderboard === undefined ? {} : { showOnLeaderboard: p.showOnLeaderboard }),
      ...(opts.finishOnboarding ? { onboarded: true } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  after(() => syncUser(user.id));
  if (payout && !hadPayout) after(() => retryPendingPayouts(user.id));

  if (opts.finishOnboarding && !user.onboarded) {
    await logEvent("user.onboarded", user.id, user.id);
    redirect(safeNext(opts.next, "/home?welcome=1"));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
