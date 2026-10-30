import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || null;
  return (
    <div className="aurora relative min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-transparent bg-bg/40 backdrop-blur-xl [@supports(backdrop-filter:blur(0))]:bg-bg/30">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <Link href="/#how" className="transition hover:text-fg">How it works</Link>
            <Link href="/#bounties" className="transition hover:text-fg">Bounties</Link>
            <Link href="/#pricing" className="transition hover:text-fg">Pricing</Link>
            <Link href="/live" className="inline-flex items-center gap-1.5 transition hover:text-fg">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/home" size="sm">Open app</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
                <ButtonLink href="/signup" size="sm">Join the mesh</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-subtle sm:inline">·</span>
            <span className="text-subtle">Built at Hacker House Goa 2026</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/live" className="hover:text-fg">Live mesh</Link>
            <Link href="/terms" className="hover:text-fg">Terms</Link>
            <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            <Link href="/refunds" className="hover:text-fg">Refunds</Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="hover:text-fg">Contact</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
