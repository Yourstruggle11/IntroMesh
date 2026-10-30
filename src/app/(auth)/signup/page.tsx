import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms/auth-forms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Join the mesh" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? safeNext(next) : "/onboarding");
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-semibold tracking-tight">Join the mesh</h1>
      <p className="mt-2 text-sm text-muted">Find warm paths to anyone at Hacker House Goa — and get paid for the intros you make.</p>
      <div className="mt-8">
        <SignupForm next={next ? safeNext(next, "") : undefined} />
      </div>
    </div>
  );
}
