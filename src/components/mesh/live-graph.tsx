"use client";

import { useEffect, useRef } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";

export type LiveNode = { id: string; label: string; size: number; joinedAt: string };
export type LiveLink = { source: string; target: string; at: string };

type N = SimulationNodeDatum & { id: string; label: string; size: number; joined: number; seen: number };
type L = SimulationLinkDatum<N> & { key: string; at: number; seen: number };

/** "Just happened" on the big screen means the last 15 minutes. */
export const RECENT_MS = 15 * 60_000;
const PULSE_MS = 8000;

const radius = (size: number) => 5 + Math.sqrt(size) * 3.4;

/** teal → cyan → violet as a builder becomes more connected. */
function tint(t: number, a = 1) {
  const stops = [
    [46, 230, 182],
    [59, 200, 240],
    [124, 131, 255],
  ];
  const x = Math.min(1, Math.max(0, t)) * 2;
  const i = Math.min(1, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

const linkKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function LiveGraph({ nodes, links, className }: { nodes: LiveNode[]; links: LiveLink[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ nodes: N[]; links: L[]; sim: Simulation<N, L> | null; loaded: boolean }>({ nodes: [], links: [], sim: null, loaded: false });

  // Merge each poll into the running simulation so existing builders keep their place and new ones fly in.
  useEffect(() => {
    const s = state.current;
    const now = performance.now();
    const old = new Map(s.nodes.map((n) => [n.id, n]));
    const oldLinks = new Map(s.links.map((l) => [l.key, l]));
    const firstLoad = !s.loaded;

    const byId = new Map<string, N>();
    s.nodes = nodes.map((n) => {
      const prev = old.get(n.id);
      if (prev) return Object.assign(prev, { label: n.label, size: n.size });
      const angle = Math.random() * Math.PI * 2;
      const fresh: N = { id: n.id, label: n.label, size: n.size, joined: Date.parse(n.joinedAt) || 0, seen: firstLoad ? 0 : now, x: Math.cos(angle) * 40, y: Math.sin(angle) * 40 };
      return fresh;
    });
    for (const n of s.nodes) byId.set(n.id, n);
    // Start a newcomer next to someone they just connected with.
    for (const l of links) {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      if (!a || !b) continue;
      if (!old.has(a.id) && old.has(b.id) && b.x != null) Object.assign(a, { x: b.x + 12, y: (b.y ?? 0) + 12 });
      if (!old.has(b.id) && old.has(a.id) && a.x != null) Object.assign(b, { x: a.x + 12, y: (a.y ?? 0) + 12 });
    }
    s.links = links
      .filter((l) => byId.has(l.source) && byId.has(l.target))
      .map((l) => {
        const key = linkKey(l.source, l.target);
        return { key, source: l.source, target: l.target, at: Date.parse(l.at) || 0, seen: oldLinks.has(key) || firstLoad ? (oldLinks.get(key)?.seen ?? 0) : now };
      });
    s.loaded = true;

    if (!s.sim) {
      s.sim = forceSimulation<N, L>()
        .force("x", forceX<N>(0).strength(0.06))
        .force("y", forceY<N>(0).strength(0.06))
        .alphaDecay(0.025)
        .velocityDecay(0.38);
    }
    s.sim.nodes(s.nodes);
    s.sim.force("charge", forceManyBody<N>().strength((d) => -140 - radius(d.size) * 14).distanceMax(700));
    s.sim.force(
      "link",
      forceLink<N, L>(s.links)
        .id((d) => d.id)
        .distance((l) => 34 + radius((l.source as N).size ?? 0) + radius((l.target as N).size ?? 0))
        .strength(0.18),
    );
    s.sim.force("collide", forceCollide<N>().radius((d) => radius(d.size) + (d.label ? 18 : 7)).strength(0.9));
    s.sim.alpha(firstLoad ? 1 : 0.5).restart();
  }, [nodes, links]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const family = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
    let raf = 0;
    let w = 0;
    let h = 0;
    const view = { k: 1, x: 0, y: 0, ready: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.ready = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const { nodes: ns, links: ls } = state.current;
      const t = performance.now();
      const wall = Date.now();
      ctx.clearRect(0, 0, w, h);

      if (ns.length === 0 || ns[0].x == null) {
        ctx.font = `500 15px ${family}`;
        ctx.fillStyle = "rgba(148,163,184,0.7)";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for the first QR scan…", w / 2, h / 2);
        raf = requestAnimationFrame(draw);
        return;
      }

      // Zoom to fit everyone on screen, easing so the camera never jumps.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of ns) {
        const r = radius(n.size) + (n.label ? 26 : 8);
        minX = Math.min(minX, n.x! - r);
        maxX = Math.max(maxX, n.x! + r);
        minY = Math.min(minY, n.y! - r);
        maxY = Math.max(maxY, n.y! + r + (n.label ? 14 : 0));
      }
      const pad = 36;
      const k = Math.min(2.2, Math.max(0.3, Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxY - minY))));
      const tx = w / 2 - ((minX + maxX) / 2) * k;
      const ty = h / 2 - ((minY + maxY) / 2) * k;
      const ease = view.ready ? 0.08 : 1;
      view.k += (k - view.k) * ease;
      view.x += (tx - view.x) * ease;
      view.y += (ty - view.y) * ease;
      view.ready = true;
      const sx = (x: number) => x * view.k + view.x;
      const sy = (y: number) => y * view.k + view.y;
      const scale = Math.min(1.5, Math.max(0.75, view.k));

      // Connections: quiet by default, gold when they just happened.
      for (const l of ls) {
        const a = l.source as N;
        const b = l.target as N;
        if (a.x == null || b.x == null) continue;
        const pulse = l.seen ? Math.max(0, 1 - (t - l.seen) / PULSE_MS) : 0;
        const recent = wall - l.at < RECENT_MS;
        ctx.beginPath();
        ctx.moveTo(sx(a.x), sy(a.y!));
        ctx.lineTo(sx(b.x), sy(b.y!));
        if (recent || pulse > 0) {
          ctx.strokeStyle = `rgba(251,191,36,${0.55 + pulse * 0.4})`;
          ctx.lineWidth = 1.6 + pulse * 2.5;
        } else {
          ctx.strokeStyle = "rgba(148,190,230,0.17)";
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }

      // Builders: size and colour by how connected they are; hubs drawn last so they sit on top.
      const maxSize = Math.max(1, ...ns.map((n) => n.size));
      const ordered = [...ns].sort((a, b) => a.size - b.size);
      for (const n of ordered) {
        const x = sx(n.x!);
        const y = sy(n.y!);
        const r = radius(n.size) * scale;
        const c = n.size / maxSize;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
        glow.addColorStop(0, tint(c, 0.32));
        glow.addColorStop(1, tint(c, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tint(c, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        const pulse = n.seen ? Math.max(0, 1 - (t - n.seen) / PULSE_MS) : 0;
        if (pulse > 0 || wall - n.joined < RECENT_MS) {
          ctx.strokeStyle = `rgba(251,191,36,${0.7 + pulse * 0.3})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, r + 3 + pulse * 10, 0, Math.PI * 2);
          ctx.stroke();
        } else if (n.label) {
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Names (only members who opted in), biggest first, skipping any that would overlap.
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      for (const n of [...ordered].reverse()) {
        if (!n.label) continue;
        const r = radius(n.size) * scale;
        const fs = Math.round(Math.min(18, 12 + Math.sqrt(n.size) * 1.3));
        ctx.font = `600 ${fs}px ${family}`;
        const tw = ctx.measureText(n.label).width;
        const x = sx(n.x!);
        const y = sy(n.y!) + r + 5;
        const box = { x0: x - tw / 2 - 3, y0: y - 2, x1: x + tw / 2 + 3, y1: y + fs + 2 };
        if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
        placed.push(box);
        ctx.strokeStyle = "rgba(5,8,15,0.92)";
        ctx.lineWidth = 4;
        ctx.strokeText(n.label, x, y);
        ctx.fillStyle = "rgba(240,245,252,0.96)";
        ctx.fillText(n.label, x, y);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-label="Live graph of connections at Hacker House Goa" />;
}
