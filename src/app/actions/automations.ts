"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth";
import { deliverAutomation, validateWebhookUrl } from "@/lib/automations";

export async function saveAutomationWebhookAction(raw: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireOnboardedUser();
  const value = String(raw ?? "").trim();
  if (!value) {
    await db.update(users).set({ automationWebhookUrl: null, updatedAt: new Date() }).where(eq(users.id, me.id));
    revalidatePath("/settings");
    return { ok: true };
  }
  if (value.length > 500) return { error: "That URL is too long." };
  const check = await validateWebhookUrl(value);
  if (!check.ok) return { error: check.error };
  await db.update(users).set({ automationWebhookUrl: check.url, updatedAt: new Date() }).where(eq(users.id, me.id));
  revalidatePath("/settings");
  return { ok: true };
}

export async function sendTestAutomationAction(): Promise<{ ok?: boolean; error?: string; status?: number }> {
  const me = await requireOnboardedUser();
  if (!me.automationWebhookUrl) return { error: "Save a webhook URL first." };
  const r = await deliverAutomation(me.id, {
    type: "test",
    title: "IntroMesh test event 🎉",
    body: "If you can see this in viaSocket, your automations are wired up.",
    link: "/settings#automations",
  });
  return r.ok ? { ok: true, status: r.status } : { error: r.error ?? "Delivery failed", status: r.status };
}
