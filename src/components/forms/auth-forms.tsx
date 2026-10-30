"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { loginAction, signupAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";

function PasswordInput({ autoComplete }: { autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id="password" name="password" type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : 1} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ErrorBox({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return <div className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">{state.error}</div>;
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required defaultValue={state?.fields?.name} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required defaultValue={state?.fields?.email} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <PasswordInput autoComplete="new-password" />
        <p className="mt-1.5 text-xs text-subtle">At least 8 characters.</p>
      </div>
      <ErrorBox state={state} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted">
        Already in the mesh?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required defaultValue={state?.fields?.email} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <PasswordInput autoComplete="current-password" />
      </div>
      <ErrorBox state={state} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Log in <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-brand hover:underline">
          Join the mesh
        </Link>
      </p>
    </form>
  );
}
