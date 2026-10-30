"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { connectCode, logEvent } from "@/lib/activity";
import { createSession, destroySession, hashPassword, safeNext, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; ok?: boolean; fields?: Record<string, string> } | null;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
  });
  const fields = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details", fields };
  const { name, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "An account with this email already exists. Log in instead.", fields };

  const passwordHash = await hashPassword(password);
  let userId: string | null = null;
  for (let i = 0; i < 5 && !userId; i++) {
    try {
      const [u] = await db.insert(users).values({ name, email, passwordHash, connectCode: connectCode() }).returning({ id: users.id });
      userId = u.id;
    } catch (err) {
      if (!String((err as Error).message).includes("connect_code")) throw err;
    }
  }
  if (!userId) return { error: "Something went wrong — please try again.", fields };

  await createSession(userId);
  await logEvent("user.signup", userId, userId);
  const next = safeNext(formData.get("next"), "");
  redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
}

const loginSchema = z.object({
  email: z.email("Enter a valid email").transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: String(formData.get("email") ?? "").trim(), password: formData.get("password") });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details", fields };
  const [u] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Compare against a real hash even for unknown emails so timing doesn't reveal which accounts exist.
  const ok = await verifyPassword(parsed.data.password, u?.passwordHash ?? (await dummyHash()));
  if (!u || !ok) return { error: "Email or password is incorrect.", fields };
  await createSession(u.id);
  if (!u.onboarded) redirect("/onboarding");
  redirect(safeNext(formData.get("next"), "/home"));
}

let dummy: Promise<string> | null = null;
function dummyHash() {
  return (dummy ??= hashPassword("intromesh-timing-guard"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
