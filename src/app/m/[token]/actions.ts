"use server";

import { redirect } from "next/navigation";
import { confirmMet, IntroError } from "@/lib/intros";

export async function confirmMeetingFromToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) redirect("/");
  try {
    await confirmMet("", { kind: "target-token", token });
  } catch (err) {
    if (!(err instanceof IntroError)) throw err;
  }
  redirect(`/m/${token}?done=1`);
}
