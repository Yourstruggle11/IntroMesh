import "server-only";
import { randomBytes } from "crypto";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, contacts, introRequests, paymentOrders, users, type IntroRequest, type PathNode, type User } from "@/db/schema";
import { logEvent, notify } from "@/lib/activity";
import { draftIntro } from "@/lib/ai";
import { effectivePlan, usage } from "@/lib/billing";
import { chainConfig, cryptoNetwork, formatUnits6, isChainKey, usdToUnits, type ChainKey, defaultChain } from "@/lib/crypto/chains";
import { createOrder, sendUsdc, walletConfigured } from "@/lib/crypto/payments";
import { sendEmail } from "@/lib/email";
import { introEmail, notifyEmail, targetConfirmEmail } from "@/lib/email/templates";
import { contactNode, isUserNode, nodeDetails, pathsTo, rawId, reachable, userNode, type NodeId } from "@/lib/graph";
import { absoluteUrl, firstName, maskName } from "@/lib/utils";

export const OPEN_STATUSES = ["awaiting_payment", "pending", "accepted", "introduced"] as const;
const REQUEST_TTL_DAYS = 7;
const MEETING_TTL_DAYS = 14;

export class IntroError extends Error {}

export function bountyLabel(intro: Pick<IntroRequest, "bountyUnits" | "bountyChain" | "bountyNetwork">) {
  if (!intro.bountyUnits || !intro.bountyChain) return null;
  const chain = isChainKey(intro.bountyChain) ? chainConfig(intro.bountyChain, intro.bountyNetwork).label : intro.bountyChain;
  return `$${formatUnits6(intro.bountyUnits).replace(/\.00$/, "")} USDC on ${chain}`;
}

/** Does `connectorId` directly know the target? */
async function connectorKnowsTarget(connectorId: string, target: NodeId): Promise<boolean> {
  if (isUserNode(target)) {
    const t = rawId(target);
    const [a, b] = [connectorId, t].sort();
    const [c] = await db.select({ id: connections.id }).from(connections).where(and(eq(connections.userA, a), eq(connections.userB, b))).limit(1);
    if (c) return true;
    const [tu] = await db.select({ email: users.email }).from(users).where(eq(users.id, t)).limit(1);
    if (!tu) return false;
    const [ct] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.ownerId, connectorId), eq(contacts.email, tu.email))).limit(1);
    return Boolean(ct);
  }
  const [ct] = await db.select({ ownerId: contacts.ownerId }).from(contacts).where(eq(contacts.id, rawId(target))).limit(1);
  return ct?.ownerId === connectorId;
}

async function areConnected(a: string, b: string) {
  const [x, y] = [a, b].sort();
  const [c] = await db.select({ id: connections.id }).from(connections).where(and(eq(connections.userA, x), eq(connections.userB, y))).limit(1);
  return Boolean(c);
}

/* ───────────────────────── Create ───────────────────────── */

export async function createIntroRequest(
  requester: User,
  input: { target: NodeId; connectorId: string; reason: string; bountyUsd?: number | null; chain?: string | null },
): Promise<{ introId: string; orderId?: string }> {
  const reason = input.reason.trim();
  // Accept either a raw user id or a graph node id ("u:<uuid>").
  const connectorRaw = input.connectorId.startsWith("u:") ? rawId(input.connectorId) : input.connectorId;
  if (!/^[0-9a-f-]{36}$/i.test(connectorRaw)) throw new IntroError("Invalid connector.");
  if (!/^[uc]:[0-9a-f-]{36}$/i.test(input.target)) throw new IntroError("Invalid target.");
  input = { ...input, connectorId: connectorRaw };
  if (reason.length < 15) throw new IntroError("Tell the connector a bit more about why (at least 15 characters).");
  if (reason.length > 1500) throw new IntroError("Please keep the reason under 1,500 characters.");
  if (input.connectorId === requester.id) throw new IntroError("You can't ask yourself for an intro.");
  if (input.target === userNode(requester.id)) throw new IntroError("That's you!");
  if (isUserNode(input.target) && (await areConnected(requester.id, rawId(input.target)))) {
    throw new IntroError("You're already connected — just reach out directly.");
  }
  if (!(await connectorKnowsTarget(input.connectorId, input.target))) throw new IntroError("That connector isn't directly connected to this person.");

  const [connector] = await db.select().from(users).where(eq(users.id, input.connectorId)).limit(1);
  if (!connector) throw new IntroError("Connector not found.");

  // Open duplicate?
  const targetCond = isUserNode(input.target) ? eq(introRequests.targetUserId, rawId(input.target)) : eq(introRequests.targetContactId, rawId(input.target));
  const [dup] = await db
    .select({ id: introRequests.id })
    .from(introRequests)
    .where(and(eq(introRequests.requesterId, requester.id), targetCond, inArray(introRequests.status, [...OPEN_STATUSES])))
    .limit(1);
  if (dup) throw new IntroError("You already have an open request for this person.");

  // Plan limits
  const u = await usage(requester);
  if (u.requestsLeft !== null && u.requestsLeft <= 0) throw new IntroError(`You've used all ${u.requestsLimit} intro requests on the ${u.plan.name} plan this month. Upgrade for more.`);
  let bountyUnits: bigint | null = null;
  let chain: ChainKey | null = null;
  if (input.bountyUsd && input.bountyUsd > 0) {
    const plan = effectivePlan(requester);
    if (input.bountyUsd < 1) throw new IntroError("Minimum bounty is $1.");
    if (input.bountyUsd > plan.maxBountyUsd) throw new IntroError(`Bounties on the ${plan.name} plan are capped at $${plan.maxBountyUsd}.`);
    if (!walletConfigured()) throw new IntroError("Bounties aren't available yet — the payment wallet isn't configured.");
    chain = isChainKey(input.chain) ? input.chain : defaultChain();
    bountyUnits = usdToUnits(input.bountyUsd);
  }

  // Recompute the trusted path server-side (never trust the client).
  const path = await buildPath(requester.id, input.target, input.connectorId);

  const [intro] = await db
    .insert(introRequests)
    .values({
      requesterId: requester.id,
      connectorId: input.connectorId,
      targetType: isUserNode(input.target) ? "user" : "contact",
      targetUserId: isUserNode(input.target) ? rawId(input.target) : null,
      targetContactId: isUserNode(input.target) ? null : rawId(input.target),
      reason,
      path,
      status: bountyUnits ? "awaiting_payment" : "pending",
      bountyUnits,
      bountyChain: chain,
      bountyNetwork: bountyUnits ? cryptoNetwork() : null,
      bountyStatus: bountyUnits ? "awaiting_payment" : "none",
      targetConfirmToken: randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86400_000),
    })
    .returning();

  await logEvent("intro.requested", requester.id, intro.id, { connectorId: connector.id, bounty: bountyUnits?.toString() ?? null });

  if (bountyUnits && chain) {
    const order = await createOrder({
      userId: requester.id,
      purpose: "bounty",
      usdCents: Math.round(Number(bountyUnits) / 10_000),
      chain,
      introRequestId: intro.id,
    });
    return { introId: intro.id, orderId: order.id };
  }
  await notifyConnectorOfRequest(intro.id);
  return { introId: intro.id };
}

async function buildPath(requesterId: string, target: NodeId, connectorId: string): Promise<PathNode[]> {
  let nodes: NodeId[] = [userNode(requesterId), userNode(connectorId), target];
  try {
    const { reach } = await reachable(requesterId, 3);
    const candidates = pathsTo(reach, target, 6);
    const viaConnector = candidates.find((p) => p[p.length - 2] === userNode(connectorId));
    if (viaConnector) nodes = viaConnector;
  } catch {
    /* fall back to the 3-node path */
  }
  const info = await nodeDetails(nodes);
  return nodes.map((id) => {
    const n = info.get(id);
    const isContact = !isUserNode(id);
    return {
      id,
      kind: isContact ? "contact" : "user",
      name: isContact ? maskName(n?.name ?? "Contact") : (n?.name ?? "Member"),
      company: n?.company ?? null,
      role: n?.role ?? null,
      masked: isContact,
    };
  });
}

/* ───────────────────────── Notifications ───────────────────────── */

async function loadParties(intro: IntroRequest) {
  const ids = [intro.requesterId, intro.connectorId, intro.targetUserId].filter(Boolean) as string[];
  const rows = await db.select().from(users).where(inArray(users.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const requester = byId.get(intro.requesterId)!;
  const connector = byId.get(intro.connectorId)!;
  let target: { name: string; email: string; role: string | null; company: string | null; userId: string | null };
  if (intro.targetUserId) {
    const t = byId.get(intro.targetUserId)!;
    target = { name: t.name, email: t.email, role: t.role, company: t.company, userId: t.id };
  } else {
    const [c] = await db.select().from(contacts).where(eq(contacts.id, intro.targetContactId!)).limit(1);
    target = { name: c?.name ?? "your contact", email: c?.email ?? "", role: c?.role ?? null, company: c?.company ?? null, userId: null };
  }
  return { requester, connector, target };
}

async function notifyConnectorOfRequest(introId: string) {
  const [intro] = await db.select().from(introRequests).where(eq(introRequests.id, introId)).limit(1);
  if (!intro) return;
  const { requester, connector, target } = await loadParties(intro);
  const bounty = bountyLabel(intro);
  const title = `${requester.name} wants an intro to ${target.name}${bounty ? ` · ${bounty} bounty` : ""}`;
  await notify(connector.id, { type: "intro_request", title, body: intro.reason.slice(0, 160), link: `/intros/${intro.id}` });
  const mail = notifyEmail({
    to: connector.email,
    title: `New intro request from ${requester.name}`,
    lines: [
      `${requester.name}${requester.headline ? ` (${requester.headline})` : ""} would like you to introduce them to ${target.name}.`,
      `Why: “${intro.reason.slice(0, 400)}”`,
      bounty ? `They've attached a ${bounty} bounty — paid to you once the meeting happens.` : "You stay in control: nothing is shared until you approve.",
    ],
    cta: { href: absoluteUrl(`/intros/${intro.id}`), label: "Review request" },
  });
  await sendEmail({ kind: "intro_request", relatedId: intro.id, to: connector.email, ...mail });
}

/* ───────────────────────── Bounty funding (called when payment verified) ───────────────────────── */

export async function markBountyHeld(introId: string, payerAddress: string) {
  const [intro] = await db
    .update(introRequests)
    .set({ status: "pending", bountyStatus: "held", payerAddress, updatedAt: new Date(), expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86400_000) })
    .where(and(eq(introRequests.id, introId), eq(introRequests.bountyStatus, "awaiting_payment")))
    .returning();
  if (!intro) return;
  await logEvent("bounty.held", intro.requesterId, intro.id, { units: intro.bountyUnits?.toString(), chain: intro.bountyChain });
  if (intro.status === "pending") await notifyConnectorOfRequest(intro.id);
}

/* ───────────────────────── Connector actions ───────────────────────── */

async function loadForConnector(user: User, introId: string) {
  const [intro] = await db.select().from(introRequests).where(eq(introRequests.id, introId)).limit(1);
  if (!intro || intro.connectorId !== user.id) throw new IntroError("Intro request not found.");
  return intro;
}

export async function generateDraft(user: User, introId: string, opts: { regenerate?: boolean } = {}) {
  const intro = await loadForConnector(user, introId);
  if (!["pending", "accepted"].includes(intro.status)) throw new IntroError("This request can no longer be edited.");
  if (intro.draftBody && !opts.regenerate) return { subject: intro.draftSubject!, body: intro.draftBody };
  const { requester, connector, target } = await loadParties(intro);
  const draft = await draftIntro({
    connector: { name: connector.name, company: connector.company },
    requester: { name: requester.name, headline: requester.headline, role: requester.role, company: requester.company },
    target: { name: target.name, role: target.role, company: target.company },
    reason: intro.reason,
  });
  await db.update(introRequests).set({ draftSubject: draft.subject, draftBody: draft.body, updatedAt: new Date() }).where(eq(introRequests.id, intro.id));
  return draft;
}

export async function sendIntro(user: User, introId: string, edited: { subject: string; body: string }) {
  const intro = await loadForConnector(user, introId);
  if (!["pending", "accepted"].includes(intro.status)) throw new IntroError("This request is no longer open.");
  const subject = edited.subject.trim().slice(0, 180);
  const body = edited.body.trim().slice(0, 5000);
  if (subject.length < 3 || body.length < 30) throw new IntroError("The intro email looks too short.");

  // Claim the request (pending|accepted → accepted) so two tabs can't both send.
  const [claimed] = await db
    .update(introRequests)
    .set({ status: "accepted", draftSubject: subject, draftBody: body, decidedAt: intro.decidedAt ?? new Date(), updatedAt: new Date() })
    .where(and(eq(introRequests.id, intro.id), inArray(introRequests.status, ["pending", "accepted"])))
    .returning();
  if (!claimed) throw new IntroError("This request was already handled.");

  const { requester, connector, target } = await loadParties(claimed);
  if (!target.email) throw new IntroError("This contact has no email address.");

  const mail = introEmail({ subject, body, connectorName: connector.name });
  const res = await sendEmail({
    kind: "intro",
    relatedId: claimed.id,
    to: target.email,
    cc: [requester.email, connector.email],
    replyTo: connector.email,
    ...mail,
  });
  if (res.status === "failed") {
    throw new IntroError(`Email delivery failed: ${res.error ?? "unknown error"}. Your intro is saved — try sending again.`);
  }

  await db
    .update(introRequests)
    .set({ status: "introduced", introducedAt: new Date(), expiresAt: new Date(Date.now() + MEETING_TTL_DAYS * 86400_000), updatedAt: new Date() })
    .where(eq(introRequests.id, claimed.id));
  await logEvent("intro.introduced", connector.id, claimed.id, { requesterId: requester.id });

  // Private confirmation link for the target only.
  const confirm = targetConfirmEmail({
    targetName: firstName(target.name),
    requesterName: requester.name,
    connectorName: connector.name,
    confirmUrl: absoluteUrl(`/m/${claimed.targetConfirmToken}`),
    bountyLabel: claimed.bountyStatus === "held" ? bountyLabel(claimed) : null,
  });
  await sendEmail({ kind: "target_confirm", relatedId: claimed.id, to: target.email, ...confirm });

  await notify(requester.id, {
    type: "intro_sent",
    title: `${connector.name} introduced you to ${target.name} 🎉`,
    body: "Check your inbox — you're CC'd. Confirm here once you've met.",
    link: `/intros/${claimed.id}`,
  });
  if (target.userId) {
    await notify(target.userId, { type: "intro_received", title: `${connector.name} introduced you to ${requester.name}`, body: "Check your inbox.", link: `/intros/${claimed.id}` });
  }
}

export async function declineIntro(user: User, introId: string, note?: string) {
  const intro = await loadForConnector(user, introId);
  const [d] = await db
    .update(introRequests)
    .set({ status: "declined", declineNote: note?.trim().slice(0, 500) || null, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(introRequests.id, intro.id), inArray(introRequests.status, ["pending", "accepted"])))
    .returning();
  if (!d) throw new IntroError("This request was already handled.");
  await logEvent("intro.declined", user.id, d.id, {});
  const { requester, target } = await loadParties(d);
  await notify(requester.id, {
    type: "intro_declined",
    title: `${user.name} couldn't make the intro to ${target.name}`,
    body: d.declineNote ?? (d.bountyStatus === "held" ? "Your bounty is being refunded." : undefined),
    link: `/intros/${d.id}`,
  });
  if (d.bountyStatus === "held") await refundBounty(d.id);
}

/* ───────────────────────── Requester actions ───────────────────────── */

export async function cancelIntro(user: User, introId: string) {
  const [c] = await db
    .update(introRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(introRequests.id, introId), eq(introRequests.requesterId, user.id), inArray(introRequests.status, ["awaiting_payment", "pending"])))
    .returning();
  if (!c) throw new IntroError("This request can't be cancelled anymore.");
  if (c.bountyStatus === "held") await refundBounty(c.id);
  else if (c.bountyStatus === "awaiting_payment") {
    await db.update(introRequests).set({ bountyStatus: "none" }).where(eq(introRequests.id, c.id));
    await db.update(paymentOrders).set({ status: "cancelled" }).where(and(eq(paymentOrders.introRequestId, c.id), eq(paymentOrders.status, "pending")));
  }
}

/* ───────────────────────── Meeting confirmation ───────────────────────── */

export async function confirmMet(introId: string, by: { kind: "requester"; user: User } | { kind: "target-user"; user: User } | { kind: "target-token"; token: string }) {
  const [intro] =
    by.kind === "target-token"
      ? await db.select().from(introRequests).where(eq(introRequests.targetConfirmToken, by.token)).limit(1)
      : await db.select().from(introRequests).where(eq(introRequests.id, introId)).limit(1);
  if (!intro) throw new IntroError("Intro not found.");
  if (by.kind === "requester" && intro.requesterId !== by.user.id) throw new IntroError("Intro not found.");
  if (by.kind === "target-user" && intro.targetUserId !== by.user.id) throw new IntroError("Intro not found.");
  if (!["introduced", "met"].includes(intro.status)) throw new IntroError("The intro hasn't been made yet.");

  const now = new Date();
  const patch = by.kind === "requester" ? { requesterConfirmedAt: intro.requesterConfirmedAt ?? now } : { targetConfirmedAt: intro.targetConfirmedAt ?? now };
  const [u] = await db.update(introRequests).set({ ...patch, updatedAt: now }).where(eq(introRequests.id, intro.id)).returning();
  await logEvent("intro.confirmed", by.kind === "target-token" ? null : by.user.id, intro.id, { by: by.kind });

  if (u.requesterConfirmedAt && u.targetConfirmedAt && u.status === "introduced") {
    const [met] = await db
      .update(introRequests)
      .set({ status: "met", metAt: now, updatedAt: now })
      .where(and(eq(introRequests.id, u.id), eq(introRequests.status, "introduced")))
      .returning();
    if (met) {
      await logEvent("intro.met", null, met.id, { connectorId: met.connectorId });
      await notify(met.connectorId, { type: "intro_met", title: "Your intro turned into a meeting 🤝", body: met.bountyStatus === "held" ? "Your bounty is on its way." : undefined, link: `/intros/${met.id}` });
      await notify(met.requesterId, { type: "intro_met", title: "Meeting confirmed by both sides ✅", link: `/intros/${met.id}` });
      if (met.bountyStatus === "held") await payoutBounty(met.id);
    }
  }
  return u;
}

/* ───────────────────────── Payouts & refunds ───────────────────────── */

export async function payoutBounty(introId: string) {
  const [intro] = await db.select().from(introRequests).where(eq(introRequests.id, introId)).limit(1);
  if (!intro || intro.status !== "met" || !intro.bountyUnits || !intro.bountyChain) return;
  if (!["held", "payout_pending"].includes(intro.bountyStatus) || intro.payoutTxHash) return;
  const [connector] = await db.select().from(users).where(eq(users.id, intro.connectorId)).limit(1);
  if (!connector?.payoutAddress) {
    await db.update(introRequests).set({ bountyStatus: "payout_pending", bountyError: "Waiting for the connector's payout address", updatedAt: new Date() }).where(eq(introRequests.id, intro.id));
    await notify(intro.connectorId, { type: "payout_address", title: "Add a payout address to receive your bounty 💸", body: `${bountyLabel(intro)} is waiting for you.`, link: "/settings#payout" });
    return;
  }
  // Claim: only one worker may send.
  const [claimed] = await db
    .update(introRequests)
    .set({ bountyStatus: "payout_sending", bountyError: null, updatedAt: new Date() })
    .where(and(eq(introRequests.id, intro.id), inArray(introRequests.bountyStatus, ["held", "payout_pending"]), isNull(introRequests.payoutTxHash)))
    .returning();
  if (!claimed) return;
  try {
    const hash = await sendUsdc(intro.bountyChain as ChainKey, connector.payoutAddress, intro.bountyUnits, intro.bountyNetwork ?? "testnet");
    await db.update(introRequests).set({ bountyStatus: "paid", payoutTxHash: hash, updatedAt: new Date() }).where(eq(introRequests.id, intro.id));
    await logEvent("bounty.paid", null, intro.id, { connectorId: connector.id, units: intro.bountyUnits.toString(), chain: intro.bountyChain, tx: hash });
    await notify(connector.id, { type: "bounty_paid", title: `You earned ${bountyLabel(intro)} 💸`, body: "Thanks for making a great intro.", link: `/intros/${intro.id}` });
    const mail = notifyEmail({ to: connector.email, title: `You earned ${bountyLabel(intro)}`, lines: ["Your intro turned into a real meeting — the bounty has been sent to your wallet."], cta: { href: absoluteUrl(`/intros/${intro.id}`), label: "View transaction" } });
    await sendEmail({ kind: "bounty_paid", relatedId: intro.id, to: connector.email, ...mail });
  } catch (err) {
    await db.update(introRequests).set({ bountyStatus: "payout_pending", bountyError: (err as Error).message.slice(0, 300), updatedAt: new Date() }).where(eq(introRequests.id, intro.id));
    console.error("[bounty] payout failed", intro.id, err);
  }
}

export async function refundBounty(introId: string) {
  const [claimed] = await db
    .update(introRequests)
    .set({ bountyStatus: "refund_sending", updatedAt: new Date() })
    .where(and(eq(introRequests.id, introId), inArray(introRequests.bountyStatus, ["held", "refund_pending"]), isNull(introRequests.refundTxHash)))
    .returning();
  if (!claimed || !claimed.bountyUnits || !claimed.bountyChain || !claimed.payerAddress) return;
  try {
    const hash = await sendUsdc(claimed.bountyChain as ChainKey, claimed.payerAddress, claimed.bountyUnits, claimed.bountyNetwork ?? "testnet");
    await db.update(introRequests).set({ bountyStatus: "refunded", refundTxHash: hash, updatedAt: new Date() }).where(eq(introRequests.id, claimed.id));
    await logEvent("bounty.refunded", null, claimed.id, { tx: hash });
    await notify(claimed.requesterId, { type: "bounty_refunded", title: `Bounty refunded: ${bountyLabel(claimed)}`, link: `/intros/${claimed.id}` });
  } catch (err) {
    await db.update(introRequests).set({ bountyStatus: "refund_pending", bountyError: (err as Error).message.slice(0, 300), updatedAt: new Date() }).where(eq(introRequests.id, claimed.id));
    console.error("[bounty] refund failed", claimed.id, err);
  }
}

/** Retry payouts waiting on a connector's payout address. */
export async function retryPendingPayouts(connectorId: string) {
  const rows = await db
    .select({ id: introRequests.id })
    .from(introRequests)
    .where(and(eq(introRequests.connectorId, connectorId), eq(introRequests.status, "met"), eq(introRequests.bountyStatus, "payout_pending")));
  for (const r of rows) await payoutBounty(r.id);
}

/* ───────────────────────── Expiry (lazy + cron) ───────────────────────── */

export async function expireDue() {
  const now = new Date();
  const due = await db
    .select()
    .from(introRequests)
    .where(and(lt(introRequests.expiresAt, now), or(inArray(introRequests.status, ["awaiting_payment", "pending", "accepted"]), eq(introRequests.status, "introduced"))))
    .limit(100);
  for (const intro of due) {
    const [e] = await db
      .update(introRequests)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(introRequests.id, intro.id), eq(introRequests.status, intro.status)))
      .returning();
    if (!e) continue;
    await logEvent("intro.expired", null, e.id, { from: intro.status });
    if (e.bountyStatus === "held") await refundBounty(e.id);
    if (e.bountyStatus === "awaiting_payment") await db.update(introRequests).set({ bountyStatus: "none" }).where(eq(introRequests.id, e.id));
  }
  // Retry failed refunds.
  const stuck = await db.select({ id: introRequests.id }).from(introRequests).where(eq(introRequests.bountyStatus, "refund_pending")).limit(20);
  for (const s of stuck) await refundBounty(s.id);
  return due.length;
}

export function introTargetNode(intro: Pick<IntroRequest, "targetUserId" | "targetContactId">): NodeId {
  return intro.targetUserId ? userNode(intro.targetUserId) : contactNode(intro.targetContactId!);
}

export const introSql = { count: sql<number>`count(*)::int` };
