import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { HeroMesh } from "@/components/mesh/hero-mesh";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="aurora grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <HeroMesh className="absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo />
          <div className="glass max-w-md rounded-3xl p-6">
            <p className="text-lg font-medium leading-relaxed">
              “The best intro I got this year came from someone two hops away. IntroMesh just makes that path visible — and says thank you on-chain.”
            </p>
            <p className="mt-4 text-sm text-muted">The IntroMesh thesis · Hacker House Goa 2026</p>
          </div>
        </div>
      </aside>
      <main className="flex min-h-dvh flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
