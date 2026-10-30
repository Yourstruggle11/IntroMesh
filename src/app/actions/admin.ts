"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { isAdmin, requireUser } from "@/lib/auth";
import { deliver } from "@/lib/email";
import { fullSync } from "@/lib/graph";
import { gsql, queryGsql, schemaGsql, tgConfigured } from "@/lib/graph/tigergraph";
import { expireDue } from "@/lib/intros";

async function requireAdmin() {
  const u = await requireUser();
  if (!isAdmin(u)) throw new Error("Not authorized");
  return u;
}

export async function setupTigerGraphAction(): Promise<{ ok: boolean; log: string }> {
  await requireAdmin();
  if (!tgConfigured()) return { ok: false, log: "TigerGraph is not configured (TG_HOST + TG_SECRET or TG_USERNAME/TG_PASSWORD)." };
  const out: string[] = [];
  try {
    out.push("— schema —");
    out.push((await gsql(schemaGsql())).slice(0, 1500));
  } catch (err) {
    out.push(`schema step: ${(err as Error).message}`);
  }
  try {
    out.push("— query —");
    out.push((await gsql(queryGsql(), 300_000)).slice(0, 2500));
  } catch (err) {
    out.push(`query step: ${(err as Error).message}`);
    return { ok: false, log: out.join("\n") };
  }
  try {
    const r = await fullSync();
    out.push(`— sync — ${r.nodes} vertices, ${r.edges} edges`);
  } catch (err) {
    out.push(`sync step: ${(err as Error).message}`);
    return { ok: false, log: out.join("\n") };
  }
  return { ok: true, log: out.join("\n") };
}

export async function resyncGraphAction(): Promise<{ ok: boolean; log: string }> {
  await requireAdmin();
  try {
    const r = await fullSync();
    return { ok: true, log: `Synced ${r.nodes} vertices and ${r.edges} edges${tgConfigured() ? " to TigerGraph" : " (TigerGraph not configured — counted only)"}.` };
  } catch (err) {
    return { ok: false, log: (err as Error).message };
  }
}

export async function runTickAction(): Promise<{ ok: boolean; log: string }> {
  await requireAdmin();
  const n = await expireDue();
  return { ok: true, log: `Expired ${n} intro(s); retried pending refunds.` };
}

export async function retryEmailAction(id: string) {
  await requireAdmin();
  const [m] = await db.select({ id: emails.id }).from(emails).where(eq(emails.id, id)).limit(1);
  if (!m) return { ok: false };
  const r = await deliver(id);
  revalidatePath("/admin");
  return { ok: r.status === "sent" || r.status === "logged", status: r.status, error: r.error };
}
