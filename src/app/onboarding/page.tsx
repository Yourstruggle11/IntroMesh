import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/forms/onboarding-wizard";
import { aiEnabled } from "@/lib/ai";
import { requireUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string; edit?: string }> }) {
  const { next, edit } = await searchParams;
  const user = await requireUser("/onboarding");
  if (user.onboarded && !edit) redirect(safeNext(next));
  return (
    <div className="aurora min-h-dvh">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Logo href="/" />
        <span className="text-sm text-muted">Hi {user.name.split(" ")[0]} 👋</span>
      </div>
      <div className="px-5 pb-20 pt-6 sm:pt-12">
        <OnboardingWizard
          aiOn={aiEnabled()}
          next={next ? safeNext(next, "") : undefined}
          initial={{
            name: user.name,
            about: user.about,
            headline: user.headline,
            role: user.role,
            company: user.company,
            lookingFor: user.lookingFor,
            canIntroduce: user.canIntroduce,
            tags: user.tags,
            payoutAddress: user.payoutAddress,
            linkedinUrl: user.linkedinUrl,
          }}
        />
      </div>
    </div>
  );
}
