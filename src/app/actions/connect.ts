"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import { connections, contacts, introRequests, users } from "@/db/schema";
import { logEvent, notify } from "@/lib/activity";
import { requireOnboardedUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/billing";
import { syncConnection, syncContact, unsyncConnection, unsyncContact } from "@/lib/graph";
import { uniqTags } from "@/lib/utils";

export async function connectByCodeAction(rawCode: string): Promise<{ ok?: boolean; error?: string; name?: string; id?: string; already?: boolean }> {
  const me = await requireOnboardedUser();
  const code = String(rawCode ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4) return { error: "Enter the 6-character code from their QR card." };
  const [other] = await db.select({ id: users.id, name: users.name, onboarded: users.onboarded }).from(users).where(eq(users.connectCode, code)).limit(1);
  if (!other) return { error: "No one in the mesh has that code." };
  if (other.id === me.id) return { error: "That's your own code 🙂" };
  const [a, b] = [me.id, other.id].sort();
  const inserted = await db.insert(connections).values({ userA: a, userB: b, source: "qr", strength: 3 }).onConflictDoNothing().returning({ id: connections.id });
  if (!inserted.length) return { ok: true, already: true, name: other.name, id: other.id };
  await logEvent("connection.created", me.id, inserted[0].id, { otherId: other.id });
  await notify(other.id, { type: "connection", title: `${me.name} connected with you`, body: me.headline ?? undefined, link: `/people/${me.id}` });
  after(() => syncConnection(a, b, 3, "qr"));
  revalidatePath("/connect");
  revalidatePath("/home");
  return { ok: true, name: other.name, id: other.id };
}

export async function removeConnectionAction(otherId: string) {
  const me = await requireOnboardedUser();
  const [a, b] = [me.id, otherId].sort();
  await db.delete(connections).where(and(eq(connections.userA, a), eq(connections.userB, b)));
  after(() => unsyncConnection(a, b));
  revalidatePath("/connect");
  return { ok: true };
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.email("Valid email required").transform((e) => e.trim().toLowerCase()),
  company: z.string().trim().max(100).optional().default(""),
  role: z.string().trim().max(100).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  tags: z.string().optional().default(""),
  strength: z.coerce.number().int().min(1).max(5).default(3),
});

async function contactBudget(userId: string, planMax: number) {
  const [c] = await db.select({ n: count() }).from(contacts).where(eq(contacts.ownerId, userId));
  return planMax - Number(c?.n ?? 0);
}

export async function addContactAction(_prev: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireOnboardedUser();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the contact details." };
  const d = parsed.data;
  if (d.email === me.email) return { error: "That's your own email." };
  if ((await contactBudget(me.id, effectivePlan(me).maxContacts)) <= 0) return { error: "You've reached your plan's contact limit — upgrade to add more." };
  const [row] = await db
    .insert(contacts)
    .values({ ownerId: me.id, name: d.name, email: d.email, company: d.company || null, role: d.role || null, notes: d.notes || null, tags: uniqTags(d.tags.split(","), 8), strength: d.strength })
    .onConflictDoNothing()
    .returning({ id: contacts.id });
  if (!row) return { error: "You already have a contact with that email." };
  await logEvent("contact.added", me.id, row.id);
  after(() => syncContact(row.id));
  revalidatePath("/connect");
  return { ok: true };
}

export async function importContactsAction(csvText: string): Promise<{ ok?: boolean; error?: string; added?: number; skipped?: number }> {
  const me = await requireOnboardedUser();
  if (!csvText || csvText.length > 2_000_000) return { error: "CSV is empty or too large (max 2MB)." };
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z]/g, "") });
  if (!parsed.data.length) return { error: "No rows found. Include a header row: name,email,company,role" };
  let budget = await contactBudget(me.id, effectivePlan(me).maxContacts);
  const seen = new Set<string>();
  const rows: (typeof contacts.$inferInsert)[] = [];
  let skipped = 0;
  for (const r of parsed.data) {
    const email = (r.email || r.emailaddress || "").trim().toLowerCase();
    const name = (r.name || r.fullname || [r.firstname, r.lastname].filter(Boolean).join(" ")).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || seen.has(email) || email === me.email || budget <= 0) {
      skipped++;
      continue;
    }
    seen.add(email);
    budget--;
    rows.push({
      ownerId: me.id,
      name: name.slice(0, 100),
      email,
      company: (r.company || r.companyname || r.organization || "").trim().slice(0, 100) || null,
      role: (r.role || r.jobtitle || r.title || r.position || "").trim().slice(0, 100) || null,
      notes: (r.notes || "").trim().slice(0, 500) || null,
      tags: uniqTags((r.tags || "").split(/[;,|]/), 8),
    });
  }
  let added = 0;
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const res = await db.insert(contacts).values(rows.slice(i, i + 200)).onConflictDoNothing().returning({ id: contacts.id });
    added += res.length;
    ids.push(...res.map((x) => x.id));
  }
  skipped += rows.length - added;
  if (added) await logEvent("contact.added", me.id, null, { bulk: added });
  after(async () => {
    for (const id of ids) await syncContact(id);
  });
  revalidatePath("/connect");
  return { ok: true, added, skipped };
}

export async function deleteContactAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireOnboardedUser();
  // Intro history (and any held bounty) references this contact; keep it intact.
  const [used] = await db.select({ n: count() }).from(introRequests).where(eq(introRequests.targetContactId, id));
  if (Number(used?.n ?? 0) > 0) return { ok: false, error: "This contact has intro history, so it can't be deleted." };
  const res = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.ownerId, me.id))).returning({ id: contacts.id });
  if (res.length) after(() => unsyncContact(id));
  revalidatePath("/connect");
  return { ok: res.length > 0 };
}
