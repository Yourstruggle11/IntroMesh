"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Coins, Handshake, Network, QrCode, Send, Trophy, Users } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/client";
import { Avatar } from "@/components/ui/primitives";
import type { LiveStats } from "@/lib/stats";
import { timeAgo } from "@/lib/utils";
import { LiveGraph } from "./live-graph";

const POLL_MS = 15_000;

function usd(units: string) {
  return Number(BigInt(units)) / 1_000_000;
}

export function LiveBoard({ initial, joinUrl, joinQrSvg }: { initial: LiveStats; joinUrl: string; joinQrSvg: string }) {
  const [s, setS] = useState(initial);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.hidden) return; // a backgrounded tab doesn't need live numbers
      try {
        const r = await fetch("/api/live");
        if (r.ok && !stopped) setS(await r.json());
      } catch {
        /* keep the last good state */
      }
    };
    // The server render may have timed out and sent an empty board: fill it in straight away.
    if (initial.graph.nodes.length === 0) void refresh();
    const t = setInterval(refresh, POLL_MS);
    const onVisible = () => !document.hidden && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial]);

  const stats = [
    { label: "Builders", value: s.totals.members, icon: Users, cls: "text-brand" },
    { label: "Connections", value: s.totals.connections, icon: Network, cls: "text-brand-2" },
    { label: "Intro requests", value: s.totals.requested, icon: Send, cls: "text-brand-3" },
    { label: "Intros made", value: s.totals.introduced, icon: Handshake, cls: "text-success" },
    { label: "USDC paid out", value: usd(s.totals.paidUnits), icon: Coins, cls: "text-gold", prefix: "$", decimals: 2 },
  ];
  const named = s.graph.nodes.filter((n) => n.label).length;

  return (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex min-h-0 flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((x) => (
            <div key={x.label} className="glass rounded-2xl p-4">
              <x.icon className={`h-4 w-4 ${x.cls}`} />
              <p className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">
                <AnimatedNumber value={x.value} prefix={x.prefix} decimals={x.decimals ?? 0} />
              </p>
              <p className="mt-0.5 text-xs text-muted">{x.label}</p>
            </div>
          ))}
        </div>
        <div className="glass relative min-h-[360px] flex-1 overflow-hidden rounded-3xl">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <LiveGraph nodes={s.graph.nodes} links={s.graph.links} className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-bg/70 px-3 py-2 text-xs text-muted backdrop-blur">
            <span className="font-semibold text-fg">{s.graph.nodes.length}</span> builders · <span className="font-semibold text-fg">{s.graph.links.length}</span> QR scans
            {named < s.graph.nodes.length && <span className="text-subtle"> · names shown for members who opted in</span>}
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-bg/70 px-3 py-2 text-xs text-muted backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-2" /> Builder · bigger = more connections
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-4 bg-brand-2/60" /> QR scan
            </span>
            <span className="inline-flex items-center gap-1.5 text-gold">
              <span className="h-0.5 w-4 bg-gold" /> Last 15 minutes
            </span>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-5">
        <div className="glass flex items-center gap-4 rounded-3xl p-4">
          {/* QR generated server-side from our own signup URL */}
          <div className="h-28 w-28 shrink-0 rounded-xl bg-white p-2 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: joinQrSvg }} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-base font-semibold">
              <QrCode className="h-4 w-4 text-brand" /> Join the mesh
            </p>
            <p className="mt-1 truncate font-mono text-xs text-brand">{joinUrl.replace(/^https?:\/\//, "").replace(/\/signup$/, "")}</p>
            <p className="mt-1.5 text-xs text-muted">Scan with your phone camera</p>
          </div>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-gold" /> Top connectors
          </p>
          <ol className="mt-4 space-y-2.5">
            {s.leaders.length === 0 && <p className="text-sm text-muted">The first intro is up for grabs…</p>}
            {s.leaders.slice(0, 5).map((l, i) => (
              <li key={l.id} className="flex items-center gap-3">
                <span className={`w-5 font-mono text-sm ${i === 0 ? "text-gold" : "text-subtle"}`}>{i + 1}</span>
                <Avatar name={l.name} seed={`u:${l.id}`} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name.split(" ")[0]}</p>
                  <p className="truncate text-[11px] text-muted">{l.company ?? ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{l.intros}</p>
                  {usd(l.earnedUnits) > 0 && <p className="font-mono text-[11px] text-gold">${usd(l.earnedUnits).toFixed(2)}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="glass min-h-0 flex-1 overflow-hidden rounded-3xl p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Happening now
          </p>
          <ul className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {s.feed.map((f) => (
                <motion.li key={f.id} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-fg/85">{f.text}</span>
                  <span className="shrink-0 text-[11px] text-subtle">{timeAgo(f.at)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
