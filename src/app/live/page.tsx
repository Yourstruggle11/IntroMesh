import type { Metadata } from "next";
import QRCode from "qrcode";
import { Logo } from "@/components/brand/logo";
import { LiveBoard } from "@/components/mesh/live-board";
import { EMPTY_LIVE_STATS, liveStats, withDeadline } from "@/lib/stats";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Live mesh · Hacker House Goa" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  // Never let the big screen fail to render: if the database is slow, start empty and let polling fill it in.
  const stats = await withDeadline(liveStats(), 5000).catch(() => EMPTY_LIVE_STATS);
  const joinUrl = absoluteUrl("/signup");
  const joinQrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 0, color: { dark: "#05080f", light: "#ffffff" } });
  return (
    <div className="aurora flex h-dvh min-h-[640px] flex-col gap-5 overflow-hidden p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-sm text-muted sm:inline">Live from Hacker House Goa 2026</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-semibold tracking-widest text-danger">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> LIVE
        </span>
      </header>
      <LiveBoard initial={stats} joinUrl={joinUrl} joinQrSvg={joinQrSvg} />
    </div>
  );
}
