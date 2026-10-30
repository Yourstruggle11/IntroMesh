import "server-only";
import { randomInt } from "crypto";
import { after } from "next/server";
import { db } from "@/db";
import { events, notifications } from "@/db/schema";
import { AUTOMATION_EVENTS, deliverAutomation } from "@/lib/automations";

export type EventType =
  | "user.signup"
  | "user.onboarded"
  | "connection.created"
  | "contact.added"
  | "intro.requested"
  | "intro.accepted"
  | "intro.introduced"
  | "intro.declined"
  | "intro.expired"
  | "intro.met"
  | "intro.confirmed"
  | "bounty.held"
  | "bounty.paid"
  | "bounty.refunded"
  | "plan.activated";

export async function logEvent(type: EventType, actorId: string | null, subjectId: string | null, data: Record<string, unknown> = {}) {
  try {
    await db.insert(events).values({ type, actorId, subjectId, data });
  } catch (err) {
    console.warn("[events] failed to log", type, (err as Error).message);
  }
}

export async function notify(userId: string, n: { type: string; title: string; body?: string; link?: string }) {
  try {
    await db.insert(notifications).values({ userId, ...n });
  } catch (err) {
    console.warn("[notify] failed", (err as Error).message);
  }
  // Mirror the notification to the member's automation webhook (viaSocket) after the response.
  if (AUTOMATION_EVENTS.some((e) => e.type === n.type)) {
    const send = () => deliverAutomation(userId, n).then(() => undefined);
    try {
      after(send);
    } catch {
      void send(); // outside a request scope (scripts)
    }
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function connectCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
