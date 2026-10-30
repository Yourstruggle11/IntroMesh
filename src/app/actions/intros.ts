"use server";

import { revalidatePath } from "next/cache";
import { polishReason } from "@/lib/ai";
import { requireOnboardedUser } from "@/lib/auth";
import { IntroError, cancelIntro, confirmMet, createIntroRequest, declineIntro, generateDraft, sendIntro } from "@/lib/intros";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    return { ok: true, ...data };
  } catch (err) {
    if (err instanceof IntroError) return { ok: false, error: err.message };
    // Let Next.js redirects/not-found propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[intros:action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createIntroAction(input: { target: string; connectorId: string; reason: string; bountyUsd?: number | null; chain?: string | null }) {
  const me = await requireOnboardedUser();
  return run(async () => {
    const r = await createIntroRequest(me, input);
    revalidatePath("/intros");
    return r;
  });
}

export async function polishReasonAction(reason: string, targetLabel: string) {
  const me = await requireOnboardedUser();
  if (reason.trim().length < 10) return { ok: false as const, error: "Write a sentence or two first." };
  const text = await polishReason(reason, { requester: me.name, target: targetLabel });
  return { ok: true as const, text };
}

export async function generateDraftAction(introId: string, regenerate = false) {
  const me = await requireOnboardedUser();
  return run(() => generateDraft(me, introId, { regenerate }));
}

export async function sendIntroAction(introId: string, subject: string, body: string) {
  const me = await requireOnboardedUser();
  return run(async () => {
    await sendIntro(me, introId, { subject, body });
    revalidatePath(`/intros/${introId}`);
    revalidatePath("/intros");
    return {};
  });
}

export async function declineIntroAction(introId: string, note?: string) {
  const me = await requireOnboardedUser();
  return run(async () => {
    await declineIntro(me, introId, note);
    revalidatePath(`/intros/${introId}`);
    revalidatePath("/intros");
    return {};
  });
}

export async function cancelIntroAction(introId: string) {
  const me = await requireOnboardedUser();
  return run(async () => {
    await cancelIntro(me, introId);
    revalidatePath(`/intros/${introId}`);
    revalidatePath("/intros");
    return {};
  });
}

export async function confirmMetAction(introId: string, as: "requester" | "target") {
  const me = await requireOnboardedUser();
  return run(async () => {
    await confirmMet(introId, as === "requester" ? { kind: "requester", user: me } : { kind: "target-user", user: me });
    revalidatePath(`/intros/${introId}`);
    return {};
  });
}
