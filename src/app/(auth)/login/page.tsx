import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? safeNext(next) : "/onboarding");
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Log in to see who&apos;s one intro away.</p>
      <div className="mt-8">
        <LoginForm next={next ? safeNext(next, "") : undefined} />
      </div>
    </div>
  );
}
