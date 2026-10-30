"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, CreditCard, Home, Inbox, LogOut, QrCode, Radio, Settings, Shield } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type NavUser = { id: string; name: string; headline: string | null; planName: string; isAdmin: boolean };
type Counts = { inbox: number; unread: number };

const MAIN = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/connect", label: "Connect", icon: QrCode },
  { href: "/intros", label: "Intros", icon: Inbox, badge: "inbox" as const },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ user, counts }: { user: NavUser; counts: Counts }) {
  const pathname = usePathname();
  const item = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
          active ? "bg-white/[0.06] text-fg" : "text-muted hover:bg-white/[0.03] hover:text-fg",
        )}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient" />}
        <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand" : "text-subtle group-hover:text-muted")} />
        {label}
        {!!badge && <span className="ml-auto rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-5 text-[#04121a]">{badge}</span>}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Logo href="/home" />
      </div>
      <nav className="mt-8 space-y-1">{MAIN.map((m) => item(m.href, m.label, m.icon, m.badge ? counts[m.badge] : undefined))}</nav>
      <div className="mt-6 space-y-1 border-t border-line pt-6">
        {item("/notifications", "Notifications", Bell, counts.unread)}
        {item("/billing", "Plans & billing", CreditCard)}
        {item("/settings", "Settings", Settings)}
        {user.isAdmin && item("/admin", "Admin", Shield)}
        <Link href="/live" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-white/[0.03] hover:text-fg">
          <Radio className="h-[18px] w-[18px] text-success" /> Live mesh
        </Link>
      </div>
      <div className="mt-auto rounded-2xl border border-line bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} seed={user.id} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.planName} plan</p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-lg p-2 text-subtle transition hover:bg-white/5 hover:text-fg" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ user, counts }: { user: NavUser; counts: Counts }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/70 px-4 backdrop-blur-xl lg:hidden">
      <Logo href="/home" />
      <div className="flex items-center gap-1">
        <Link href="/notifications" className="relative rounded-xl p-2 text-muted hover:text-fg" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {counts.unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />}
        </Link>
        <Link href="/settings" aria-label="Settings" className="ml-1">
          <Avatar name={user.name} seed={user.id} size={30} />
        </Link>
      </div>
    </header>
  );
}

export function MobileTabBar({ counts }: { counts: Counts }) {
  const pathname = usePathname();
  const tab = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = isActive(pathname, href);
    return (
      <Link key={href} href={href} className={cn("relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px]", active ? "text-fg" : "text-subtle")}>
        <Icon className={cn("h-5 w-5", active && "text-brand")} />
        {label}
        {!!badge && <span className="absolute right-[calc(50%-18px)] top-1 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-[#04121a]">{badge}</span>}
      </Link>
    );
  };
  const connectActive = isActive(pathname, "/connect");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/80 backdrop-blur-xl safe-bottom lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-2 pt-1">
        {tab("/home", "Home", Home)}
        {tab("/discover", "Discover", Compass)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/connect"
            aria-label="Connect"
            className={cn(
              "-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-[#04121a] shadow-[0_10px_30px_-6px_rgba(45,212,191,0.6)] ring-4 ring-bg transition active:scale-95",
              connectActive && "brightness-110",
            )}
          >
            <QrCode className="h-6 w-6" />
          </Link>
        </div>
        {tab("/intros", "Intros", Inbox, counts.inbox)}
        {tab("/billing", "Plan", CreditCard)}
      </div>
    </nav>
  );
}
