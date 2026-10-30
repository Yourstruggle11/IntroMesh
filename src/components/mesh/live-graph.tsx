"use client";

import { useEffect, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";

type N = SimulationNodeDatum & { id: string; label: string; size: number; born: number };
type L = SimulationLinkDatum<N> & { born: number };

function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 160 + (h % 120); // teal → violet band
}

export function LiveGraph({ nodes, links, className }: { nodes: { id: string; label: string; size: number }[]; links: { source: string; target: string }[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ nodes: N[]; links: L[]; sim: ReturnType<typeof forceSimulation<N>> | null }>({ nodes: [], links: [], sim: null });

  // Merge incoming data, keeping positions of existing nodes so the graph evolves smoothly.
  useEffect(() => {
    const s = state.current;
    const now = performance.now();
    const old = new Map(s.nodes.map((n) => [n.id, n]));
    s.nodes = nodes.map((n) => {
      const prev = old.get(n.id);
      return prev ? Object.assign(prev, { label: n.label, size: n.size }) : { ...n, born: now };
    });
    const ids = new Set(s.nodes.map((n) => n.id));
    const oldLinks = new Set(s.links.map((l) => `${(l.source as N).id ?? l.source}|${(l.target as N).id ?? l.target}`));
    s.links = links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({ source: l.source, target: l.target, born: oldLinks.has(`${l.source}|${l.target}`) ? 0 : now }));
    // Small meshes get more room so the stage screen doesn't look empty.
    const sparse = s.nodes.length < 30;
    if (!s.sim) {
      s.sim = forceSimulation<N>(s.nodes)
        .force("collide", forceCollide<N>().radius((d) => 10 + Math.min(d.size, 10)))
        .alphaDecay(0.02);
    } else {
      s.sim.nodes(s.nodes);
    }
    s.sim.force("charge", forceManyBody().strength(sparse ? -220 : -60));
    s.sim.force("link", forceLink<N, L>(s.links).id((d) => d.id).distance(sparse ? 95 : 46).strength(0.35));
    s.sim.alpha(0.6).restart();
  }, [nodes, links]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.current.sim?.force("center", forceCenter(w / 2, h / 2));
      state.current.sim?.alpha(0.3).restart();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const draw = (t: number) => {
      const { nodes: ns, links: ls } = state.current;
      ctx.clearRect(0, 0, w, h);
      for (const l of ls) {
        const a = l.source as N;
        const b = l.target as N;
        if (a.x == null || b.x == null) continue;
        const fresh = l.born ? Math.max(0, 1 - (t - l.born) / 6000) : 0;
        ctx.strokeStyle = fresh > 0 ? `rgba(251,191,36,${0.25 + fresh * 0.6})` : "rgba(94,234,212,0.18)";
        ctx.lineWidth = fresh > 0 ? 1.5 + fresh * 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y!);
        ctx.lineTo(b.x, b.y!);
        ctx.stroke();
      }
      for (const n of ns) {
        if (n.x == null) continue;
        const r = 4 + Math.min(n.size, 10) * 0.9;
        const age = Math.min(1, (t - n.born) / 1200);
        const hh = hue(n.id);
        const glow = ctx.createRadialGradient(n.x, n.y!, 0, n.x, n.y!, r * 3.2);
        glow.addColorStop(0, `hsla(${hh},80%,60%,${0.35 * age})`);
        glow.addColorStop(1, `hsla(${hh},80%,60%,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y!, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${hh},75%,62%,${age})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y!, r * age, 0, Math.PI * 2);
        ctx.fill();
        if (n.label && n.size >= 2) {
          ctx.font = "500 11px var(--font-geist-sans), system-ui";
          ctx.fillStyle = "rgba(232,238,247,0.85)";
          ctx.fillText(n.label, n.x + r + 4, n.y! + 4);
        }
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
