import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { absoluteUrl } from "@/lib/utils";

/** Events delivered to a member's automation webhook (mirrors their in-app notifications). */
export const AUTOMATION_EVENTS: { type: string; label: string }[] = [
  { type: "intro_request", label: "Someone asks you for an intro" },
  { type: "intro_sent", label: "Your intro request was approved and sent" },
  { type: "intro_received", label: "You were introduced to someone" },
  { type: "intro_declined", label: "A connector declined your request" },
  { type: "intro_met", label: "An intro turned into a meeting" },
  { type: "bounty_paid", label: "You earned a USDC bounty" },
  { type: "connection", label: "Someone connected with you" },
];

function isPrivateIp(ip: string) {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

/** Only public https endpoints: blocks SSRF into localhost / private networks / metadata IPs. */
export async function validateWebhookUrl(raw: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "That isn't a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Use an https:// webhook URL." };
  if (u.username || u.password) return { ok: false, error: "Webhook URLs can't contain credentials." };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isIP(host.replace(/^\[|\]$/g, ""))) {
    return { ok: false, error: "Use a public webhook hostname." };
  }
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) return { ok: false, error: "We couldn't resolve that host." };
  if (addrs.some((a) => isPrivateIp(a.address))) return { ok: false, error: "That host points to a private network." };
  return { ok: true, url: u.toString() };
}

export type AutomationEvent = { type: string; title: string; body?: string | null; link?: string | null };

/** POST one event to the member's webhook. Never throws. */
export async function deliverAutomation(userId: string, ev: AutomationEvent, opts: { url?: string } = {}): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const [u] = await db.select({ id: users.id, name: users.name, email: users.email, url: users.automationWebhookUrl }).from(users).where(eq(users.id, userId)).limit(1);
    const target = opts.url ?? u?.url;
    if (!u || !target) return { ok: false, error: "No webhook configured" };
    const check = await validateWebhookUrl(target); // re-check DNS at send time
    if (!check.ok) return { ok: false, error: check.error };
    const res = await fetch(check.url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", "User-Agent": "IntroMesh-Automations/1.0", "X-IntroMesh-Event": ev.type },
      body: JSON.stringify({
        app: "IntroMesh",
        event: ev.type,
        title: ev.title,
        body: ev.body ?? null,
        link: ev.link ? absoluteUrl(ev.link) : null,
        occurredAt: new Date().toISOString(),
        member: { id: u.id, name: u.name, email: u.email },
      }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, status: res.status, ...(res.ok ? {} : { error: `Webhook responded ${res.status}` }) };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}
